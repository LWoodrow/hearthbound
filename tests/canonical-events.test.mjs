import test from "node:test";
import assert from "node:assert/strict";
import { deriveCanonicalEvents, recordCanonicalTransition } from "../server/canonical-events.mjs";

test("canonical events are emitted only for accepted state changes at the new revision", () => {
  const before = { revision:2,currentLocation:"pantry",discoveries:[],objects:{hatch:{discovered:false,open:false}},outcomes:[] };
  const after = { revision:3,currentLocation:"cellar",discoveries:["cold-draught"],objects:{hatch:{discovered:true,open:true}},outcomes:[] };
  const events = deriveCanonicalEvents(before, after, { interactionIds:["enter-cellar"] });
  assert.deepEqual(events.map((event) => event.type), ["location-entered","discovery-recorded","object-state-changed","interaction-completed"]);
  assert(events.every((event) => event.revision === 3));
});

test("a state-neutral response produces no canonical transition record", () => {
  const state = { revision:4,currentLocation:"cellar",discoveries:[],objects:{},outcomes:[] };
  assert.deepEqual(recordCanonicalTransition(state, structuredClone(state)).canonicalEvents, []);
});
