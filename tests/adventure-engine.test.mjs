import test from "node:test";
import assert from "node:assert/strict";

import { validateAdventure } from "../server/adventure-schema.mjs";
import { lanternBelowAdventure } from "../server/adventures/lantern-below.mjs";
import {
  abilityCheckForAction,
  createInitialWorldState,
  resolveWorldAction,
} from "../server/world-state.mjs";

const actorId = "dad";

function act(state, action, inventory = [], mode = "act") {
  return resolveWorldAction({
    definition: lanternBelowAdventure,
    state,
    action,
    actorId,
    inventory,
    mode,
  });
}

function at(location, persisted = {}) {
  return createInitialWorldState(lanternBelowAdventure, {
    currentLocation: location,
    visited: [location],
    ...persisted,
  });
}

test("The Lantern Below definition is valid and every location is reachable", () => {
  const result = validateAdventure(lanternBelowAdventure);
  assert.equal(result.valid, true, result.errors?.join("\n"));
  assert.deepEqual(result.unreachable, []);
});

test("adventure validation rejects an exit to a missing room", () => {
  const invalid = structuredClone(lanternBelowAdventure);
  invalid.locations.inn.exits.push({ to: "missing-room", via: "impossible door" });
  const result = validateAdventure(invalid);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /missing-room/i);
});

test("looking through the windows does not move the party inside", () => {
  const initial = createInitialWorldState(lanternBelowAdventure);
  const result = act(initial, "look through the taproom windows");
  assert.equal(result.intent, "observe");
  assert.equal(result.state.currentLocation, "outside-inn");
  assert.deepEqual(result.state.visited, ["outside-inn"]);
});

test("explicit movement follows adjacent exits and cannot skip rooms", () => {
  let state = createInitialWorldState(lanternBelowAdventure);

  const skip = act(state, "go directly to the pantry");
  assert.equal(skip.accepted, false);
  assert.equal(skip.reason, "not-adjacent");
  assert.equal(skip.state.currentLocation, "outside-inn");

  const enter = act(state, "enter through the public front door");
  assert.equal(enter.accepted, true);
  assert.equal(enter.state.currentLocation, "inn");
  state = enter.state;

  const privateRoom = act(state, "go through the private-room door to the back room");
  assert.equal(privateRoom.accepted, true);
  assert.equal(privateRoom.state.currentLocation, "back-room");
  assert.deepEqual(privateRoom.state.visited, ["outside-inn", "inn", "back-room"]);
});

test("global check selection uses Perception, Investigation, and Athletics consistently", () => {
  assert.deepEqual(abilityCheckForAction("search the passage for traps"), {
    ability: "Wisdom",
    skill: "Perception",
    dc: 12,
    reason: "Search the visible area for traps or immediate hazards.",
  });
  assert.deepEqual(abilityCheckForAction("inspect the hidden mechanism"), {
    ability: "Intelligence",
    skill: "Investigation",
    dc: 12,
    reason: "Study the visible construction and evidence without operating it.",
  });
  assert.deepEqual(abilityCheckForAction("force the heavy stone door"), {
    ability: "Strength",
    skill: "Athletics",
    dc: 14,
    reason: "Overcome a demanding physical obstacle.",
  });
});

test("opening a container reveals contents without automatically looting them", () => {
  const cellarKeyOwned = { "cellar-key": actorId };
  const state = at("cellar-passage", { itemOwners: cellarKeyOwned });

  const hidden = act(state, "take the glowing key");
  assert.equal(hidden.accepted, false);
  assert.equal(hidden.reason, "item-not-present");
  assert.equal(hidden.state.itemOwners["glowing-key"], undefined);

  const opened = act(state, "open the rusted survey box");
  assert.equal(opened.accepted, true);
  assert.equal(opened.state.containers["survey-box"].open, true);
  assert.equal(opened.state.itemOwners["glowing-key"], undefined);

  const taken = act(opened.state, "take the glowing key");
  assert.equal(taken.accepted, true);
  assert.equal(taken.state.itemOwners["glowing-key"], actorId);
  assert.deepEqual(taken.events, [{ type: "item-acquired", itemId: "glowing-key", actorId }]);

  const repeated = act(taken.state, "take the glowing key");
  assert.equal(repeated.accepted, false);
  assert.equal(repeated.reason, "already-owned");
  assert.equal(repeated.state.itemOwners["glowing-key"], actorId);
});

test("Cotton is always a companion and never an inventory item", () => {
  const result = act(createInitialWorldState(lanternBelowAdventure), "pick up Cotton");
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "companion-not-item");
  assert.deepEqual(result.state.itemOwners, {});
});

test("using a matching key unlocks and opens a door atomically", () => {
  let state = at("cellar", { itemOwners: { "cellar-key": actorId } });
  const used = act(state, "use the cellar key on the stone door");
  assert.equal(used.accepted, true);
  assert.deepEqual(used.state.objects["keyed-stone-door"], { locked: false, open: true });
  state = used.state;

  const crossed = act(state, "go through the stone door");
  assert.equal(crossed.accepted, true);
  assert.equal(crossed.state.currentLocation, "cellar-passage");
});

test("locked routes remain blocked until their world-state requirement is satisfied", () => {
  const state = at("pantry");
  const blocked = act(state, "descend to the cellar");
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.reason, "requirements");
  assert.equal(blocked.state.currentLocation, "pantry");
});

test("repeated open and movement actions do not duplicate state", () => {
  const state = at("outside-inn");
  const opened = act(state, "open the public front door");
  const openedAgain = act(opened.state, "open the public front door");
  assert.equal(openedAgain.state.objects["front-door"].open, true);
  assert.equal(openedAgain.state.currentLocation, "outside-inn");

  const entered = act(openedAgain.state, "enter through the public front door");
  assert.deepEqual(entered.state.visited, ["outside-inn", "inn"]);
  const returnOutside = act(entered.state, "go outside through the public front door");
  assert.deepEqual(returnOutside.state.visited, ["outside-inn", "inn"]);
});

test("speech cannot operate objects or move the party", () => {
  const state = createInitialWorldState(lanternBelowAdventure);
  const result = act(state, "I tell everyone to enter the inn", [], "speak");
  assert.equal(result.handled, false);
  assert.equal(result.state.currentLocation, "outside-inn");
});
