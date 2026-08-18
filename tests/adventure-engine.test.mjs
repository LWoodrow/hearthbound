import test from "node:test";
import assert from "node:assert/strict";

import { validateAdventure } from "../server/adventure-schema.mjs";
import { lanternBelowAdventure } from "../server/adventures/lantern-below.mjs";
import { buildStoryAuthority } from "../server/story-authority.mjs";
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
  assert.match(result.message, /busy public taproom/i);
  assert.match(result.message, /bar.*hearth.*tables/i);
});

test("natural follow-up observation resolves singular feature wording", () => {
  const initial = createInitialWorldState(lanternBelowAdventure);
  const result = act(initial, "When I look through the window I want to see whats inside");
  assert.equal(result.accepted, true);
  assert.equal(result.state.currentLocation, "outside-inn");
  assert.match(result.message, /busy public taproom/i);
  assert.doesNotMatch(result.message, /no feature matching/i);
});

test("opening a door and walking in completes the requested crossing", () => {
  const initial = createInitialWorldState(lanternBelowAdventure);
  const result = act(initial, "open the door and walk in");
  assert.equal(result.intent, "move");
  assert.equal(result.accepted, true);
  assert.equal(result.state.currentLocation, "inn");
  assert.equal(result.state.objects["front-door"].open, true);
  assert.match(result.message, /enters.*taproom/i);
});

test("natural destination aliases and authored occupants resolve without story-specific code", () => {
  const initial=createInitialWorldState(lanternBelowAdventure);
  const movement=act(initial,"go into the tavern");
  assert.equal(movement.accepted,true);
  assert.equal(movement.state.currentLocation,"inn");
  const present=act(movement.state,"who is in the tavern not what");
  assert.match(present.message,/Tamsin Reed.*ordinary patrons.*taproom staff/i);
  const keeper=act(movement.state,"is there an innkeeper?");
  assert.match(keeper.message,/Tamsin Reed.*Innkeeper/i);
});

test("inventory availability questions list only authored portable items", () => {
  const taproom = createInitialWorldState(lanternBelowAdventure, { currentLocation:"inn" });
  const result = act(taproom, "is there anything to pickup for my inventory?");
  assert.equal(result.intent, "observe");
  assert.equal(result.accepted, true);
  assert.match(result.message, /no unattended portable item/i);
  assert.doesNotMatch(result.message, /mugs|poker|purses|pouches/i);
});

test("partial natural destination names resolve to the authored exit", () => {
  const taproom = createInitialWorldState(lanternBelowAdventure, { currentLocation:"inn" });
  const result = act(taproom, "move to private room");
  assert.equal(result.handled, true);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "requirements");
  assert.equal(result.state.currentLocation, "inn");
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

  state = createInitialWorldState(lanternBelowAdventure, { ...state, flags:{ ...state.flags, privateRoomPermission:true } });
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
  const state = at("pantry", {
    objects: { "cellar-hatch": { discovered: true } },
  });
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

test("undiscovered routes cannot be opened by guessing their authored name", () => {
  const state = at("pantry");
  const guessed = act(state, "open the concealed cellar hatch");
  assert.equal(guessed.accepted, false);
  assert.equal(guessed.reason, "hidden");
  assert.deepEqual(guessed.state.objects["cellar-hatch"], {
    discovered: false,
    locked: false,
    open: false,
  });

  const discovered = at("pantry", {
    objects: { "cellar-hatch": { discovered: true } },
  });
  const opened = act(discovered, "open the concealed cellar hatch");
  assert.equal(opened.accepted, true);
  assert.deepEqual(opened.state.objects["cellar-hatch"], {
    discovered: true,
    locked: false,
    open: true,
  });
});

test("vague forward movement never chooses an already-visited reverse exit", () => {
  const state = at("back-room", { visited: ["outside-inn", "inn", "back-room"] });
  const result = act(state, "go deeper");
  assert.equal(result.handled, false);
  assert.equal(result.state.currentLocation, "back-room");
  assert.deepEqual(result.state.visited, ["outside-inn", "inn", "back-room"]);
});

test("older partial navigation state is merged with defaults and its route is repaired", () => {
  const state = createInitialWorldState(lanternBelowAdventure, {
    currentLocation: "back-room",
    objects: { "front-door": { open: true } },
  });
  assert.deepEqual(state.visited, ["outside-inn", "inn", "back-room"]);
  assert.deepEqual(state.objects["front-door"], { locked: false, open: true });

  const invalid = createInitialWorldState(lanternBelowAdventure, {
    currentLocation: "invented-room",
    visited: ["invented-room"],
  });
  assert.equal(invalid.currentLocation, "outside-inn");
  assert.deepEqual(invalid.visited, ["outside-inn"]);
});

test("forward and back movement follow the party's graph direction", () => {
  let state = at("mothglass", {
    objects: { "spindle-door": { discovered:true, open:true } },
  });

  const passage = act(state, "go forward into the concealed passage");
  assert.equal(passage.state.currentLocation, "passage");
  assert.equal(passage.state.previousLocation, "mothglass");
  state = passage.state;

  const alcove = act(state, "continue forward");
  assert.equal(alcove.state.currentLocation, "alcove");
  assert.equal(alcove.state.previousLocation, "passage");

  const returned = act(alcove.state, "go back");
  assert.equal(returned.state.currentLocation, "passage");
  assert.equal(returned.state.previousLocation, "alcove");
});

test("every essential Lantern Below clue has multiple authored discovery sources", () => {
  const essentialClues = Object.values(lanternBelowAdventure.story.clues).filter((clue) => clue.essential);
  assert.ok(essentialClues.length >= 5);
  for (const clue of essentialClues) assert.ok(clue.sources.length >= 2, clue.fact);
});

test("adventure validation rejects a single-route essential clue", () => {
  const invalid = structuredClone(lanternBelowAdventure);
  invalid.story.clues["concealed-hatch"].sources = invalid.story.clues["concealed-hatch"].sources.slice(0, 1);
  const result = validateAdventure(invalid);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /concealed-hatch.*two independent/i);
});

test("story authority activates only NPCs and clue sources relevant to the current room", () => {
  const authority = buildStoryAuthority(lanternBelowAdventure, {
    worldState: { currentLocation:"pantry" },
    dmState: { clueStage:2 },
  });

  assert.equal(authority.currentScene.locationId, "pantry");
  assert.equal(authority.currentScene.act.id, "living-map");
  assert.deepEqual(Object.keys(authority.relevantNpcs), []);
  assert.deepEqual(Object.keys(authority.relevantClues), ["concealed-hatch"]);
  assert.match(authority.contract, /never relocate a clue/i);
  assert.ok(authority.improvisation.forbidden.some((rule) => /moving the letter/i.test(rule)));
});

test("story authority gives the taproom only Tamsin and taproom clue routes", () => {
  const authority = buildStoryAuthority(lanternBelowAdventure, {
    worldState: { currentLocation:"inn" },
    dmState: { clueStage:0 },
  });

  assert.deepEqual(Object.keys(authority.relevantNpcs), ["tamsin-reed"]);
  assert.deepEqual(Object.keys(authority.relevantClues).sort(), ["mara-sent-message", "pantry-destination"]);
  assert.equal(authority.relevantNpcs["tamsin-reed"].mustNotKnow.includes("What lies beyond the cellar"), true);
});

test("room observation uses authoritative features and object state", () => {
  const state = at("inn", { visited:["outside-inn", "inn"] });
  const room = act(state, "look around");
  assert.equal(room.handled, true);
  assert.match(room.message, /busy public room/i);
  assert.match(room.message, /staff kitchen door/i);

  const door = act(state, "look around for the kitchen door");
  assert.equal(door.handled, true);
  assert.match(door.message, /kitchen door is closed/i);
  assert.doesNotMatch(door.message, /ajar/i);

  const invented = act(at("kitchen"), "search the cluttered counter");
  assert.equal(invented.handled, true);
  assert.match(invented.message, /no feature matching/i);
  assert.doesNotMatch(invented.message, /letter/i);
});

test("authored NPC appearance and surface contents answer ordinary observation", () => {
  const taproom = at("inn");
  const tamsin = act(taproom, "what is Tamsin wearing and what colour is her hair?");
  assert.match(tamsin.message, /iron-grey hair/i);
  assert.match(tamsin.message, /dark green wool waistcoat/i);

  const backRoom = at("back-room");
  const table = act(backRoom, "what is on the private table?");
  assert.match(table.message, /sealed silver-moth letter/i);
  const inspect = act(backRoom, "inspect the private table");
  assert.match(inspect.message, /otherwise bare/i);
});

test("portable clue aliases and feature presentation follow canonical state", () => {
  let state = at("back-room");
  const taken = act(state, "pickup letter");
  assert.equal(taken.accepted, true);
  assert.equal(taken.state.itemOwners["silver-moth-letter"], actorId);
  assert.match(taken.message, /added to the inventory/i);

  state = at("back-room", { flags:{ letterOpened:true } });
  const room = act(state, "look around");
  assert.match(room.message, /opened silver-moth letter/i);
  assert.doesNotMatch(room.message, /sealed silver-moth letter/i);
  const table = act(state, "what is on the private table?");
  assert.match(table.message, /opened letter.*written instructions.*ink-mite/i);

  const carriedTable = act(taken.state, "inspect the private table");
  assert.match(carriedTable.message, /letter is now being carried/i);
  assert.doesNotMatch(carriedTable.message, /rests alone/i);
});

test("stealth movement verbs follow the same authoritative exits", () => {
  const taproom = at("inn", { visited:["outside-inn", "inn"], flags:{ pantryPermission:true } });
  const entered = act(taproom, "sneak into the kitchen through the staff kitchen door");
  assert.equal(entered.intent, "move");
  assert.equal(entered.accepted, true);
  assert.equal(entered.state.currentLocation, "kitchen");
  assert.equal(entered.state.objects["kitchen-door"].open, true);

  const impossible = act(taproom, "slip into the cellar");
  assert.equal(impossible.accepted, false);
  assert.equal(impossible.state.currentLocation, "inn");
});
