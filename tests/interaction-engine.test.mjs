import test from "node:test";
import assert from "node:assert/strict";

import { lanternBelowAdventure } from "../server/adventures/lantern-below.mjs";
import { assertCanonicalState, canonicalProjection, createCanonicalState, resolveAuthoredInteraction, resolveAuthoredInteractionSequence, validateInteractions } from "../server/interaction-engine.mjs";

function run(state, action, expected) {
  const outcome = resolveAuthoredInteraction({ definition:lanternBelowAdventure, state, action, mode:"act" });
  assert.equal(outcome.handled, true, action);
  assert.equal(outcome.interactionId, expected, action);
  return outcome.state;
}

test("Lantern authored interactions validate without adventure-specific runtime rules", () => {
  assert.deepEqual(validateInteractions(lanternBelowAdventure), []);
});

test("the letter, warmth, ink, and representation route remain separate atomic interactions", () => {
  let state = createCanonicalState(lanternBelowAdventure, { currentLocation:"back-room", visited:["outside-inn","inn","back-room"] });
  state = run(state, "examine the silver-moth seal without opening the letter", "inspect-sealed-letter");
  assert.equal(state.flags.letterOpened, false);
  state = run(state, "deliberately break the seal and open the letter", "open-silver-moth-letter");
  state = run(state, "look for fresh ink and a safe flame", "locate-mite-supplies");
  assert.equal(state.flags.miteAwake, false);
  state = run(state, "warm the silver moth over the lamp flame", "warm-ink-mite");
  assert.equal(state.flags.mapDrawn, false);
  state = run(state, "offer the ink-mite one drop of fresh ink", "offer-mite-ink");
  const beforeStudy = structuredClone(state);
  state = run(state, "investigate the drawn line to the pantry shelves", "study-drawn-route");
  assert.equal(state.currentLocation, "back-room");
  assert.deepEqual(state.flags, beforeStudy.flags);
  assert.deepEqual(state.objects, beforeStudy.objects);
  assert.deepEqual(state.discoveries, beforeStudy.discoveries);
});

test("an authored action blocked by prerequisites never falls through for AI invention", () => {
  const state = createCanonicalState(lanternBelowAdventure, { currentLocation:"back-room", visited:["outside-inn","inn","back-room"], flags:{ letterOpened:true } });
  const outcome = resolveAuthoredInteraction({ definition:lanternBelowAdventure, state, action:"put one drop of ink on ink mite", mode:"act" });
  assert.equal(outcome.handled, true);
  assert.equal(outcome.accepted, false);
  assert.equal(outcome.reason, "prerequisites");
  assert.equal(outcome.state.flags.miteAwake, false);
  assert.equal(outcome.state.flags.mapDrawn, false);
  assert.match(outcome.message, /still dormant/i);
});

test("an explicit compound action executes authored dependencies in order", () => {
  const state = createCanonicalState(lanternBelowAdventure, { currentLocation:"back-room", visited:["outside-inn","inn","back-room"] });
  const outcome = resolveAuthoredInteractionSequence({ definition:lanternBelowAdventure, state, action:"open the seal warm it and give the ink mite ink", mode:"act" });
  assert.equal(outcome.handled, true);
  assert.equal(outcome.accepted, true);
  assert.deepEqual(outcome.interactionIds, ["open-silver-moth-letter","warm-ink-mite","offer-mite-ink"]);
  assert.equal(outcome.state.flags.letterOpened, true);
  assert.equal(outcome.state.flags.miteAwake, true);
  assert.equal(outcome.state.flags.inkOffered, true);
  assert.equal(outcome.state.flags.mapDrawn, true);
});

test("completed prerequisites repeat safely while later steps continue", () => {
  let state = createCanonicalState(lanternBelowAdventure, { currentLocation:"back-room", visited:["outside-inn","inn","back-room"] });
  state = run(state, "open the letter", "open-silver-moth-letter");

  const reread = resolveAuthoredInteraction({ definition:lanternBelowAdventure, state, action:"carefully read the instructions on the parchment again", mode:"act" });
  assert.equal(reread.handled, true);
  assert.equal(reread.accepted, true);
  assert.equal(reread.repeated, true);
  assert.match(reread.message, /warm my silver moth.*one drop of fresh ink.*follow the line/i);

  const asksWhatItSays = resolveAuthoredInteraction({ definition:lanternBelowAdventure, state, action:"what do the instructions say?", mode:"act" });
  assert.equal(asksWhatItSays.handled, true);
  assert.equal(asksWhatItSays.interactionId, "reread-mara-instructions");
  assert.match(asksWhatItSays.message, /warm my silver moth.*one drop of fresh ink.*follow the line/i);

  const outcome = resolveAuthoredInteractionSequence({ definition:lanternBelowAdventure, state, action:"open the letter warm it and put ink on the ink-mite", mode:"act" });
  assert.equal(outcome.handled, true);
  assert.equal(outcome.accepted, true);
  assert.deepEqual(outcome.interactionIds, ["open-silver-moth-letter","warm-ink-mite","offer-mite-ink"]);
  assert.equal(outcome.state.flags.letterOpened, true);
  assert.equal(outcome.state.flags.miteAwake, true);
  assert.equal(outcome.state.flags.inkOffered, true);
  assert.equal(outcome.state.flags.mapDrawn, true);
});

test("canonical projections derive legacy location and stage without a second mutable truth", () => {
  let state = createCanonicalState(lanternBelowAdventure, { currentLocation:"back-room", visited:["outside-inn","inn","back-room"] });
  state = run(state, "open the letter", "open-silver-moth-letter");
  state = run(state, "warm the moth with the lamp", "warm-ink-mite");
  state = run(state, "give the mite fresh ink", "offer-mite-ink");
  assert.deepEqual(assertCanonicalState(lanternBelowAdventure, state), []);
  assert.deepEqual(canonicalProjection(lanternBelowAdventure, state), {
    privateRoomPermission:false, pantryPermission:false, letterOpened:true, suppliesLocated:false, miteAwake:true, inkOffered:true, mapDrawn:true, guardianDefeated:false, maraRescued:false, adventureComplete:false,
    currentLocationKey:"back-room", locationName:"Private Back Room", locationNote:lanternBelowAdventure.locations["back-room"].description,
    clueStage:2, dangerClock:0, storyDiscoveries:["mara-sent-message","mite-awake","pantry-destination"],
    lanternArrivalStage:2,
  });
});

test("interaction validation rejects duplicate idempotency keys and unknown locations", () => {
  const invalid = structuredClone(lanternBelowAdventure);
  invalid.interactions.push({ ...invalid.interactions[0], id:"bad-copy", location:"missing-room" });
  const errors = validateInteractions(invalid);
  assert.ok(errors.some((error) => error.includes("Duplicate idempotency")));
  assert.ok(errors.some((error) => error.includes("unknown location")));
});
