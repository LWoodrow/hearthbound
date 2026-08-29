import test from "node:test";
import assert from "node:assert/strict";
import { resolveSceneReference } from "../server/scene-reference-resolver.mjs";

const surface = {
  visibleFeatures:[{id:"cellar-hatch",label:"concealed cellar hatch",kind:"object"},{id:"barrels",label:"old barrels",kind:"scenery"}],
  exits:[{id:"exit:pantry:cellar",destination:"Cellar",via:"concealed cellar hatch",direction:"down",objectId:"cellar-hatch"}],
  presentNpcs:[{id:"tamsin",name:"Tamsin Reed"}],
  carriedItems:[{id:"cellar-key",name:"Cellar key"}],
};

test("observation prefers the exact visible feature over a similarly named carried item", () => {
  const result = resolveSceneReference({ surface, action:"look at the cellar hatch" });
  assert.equal(result.intent, "observe");
  assert.equal(result.selected?.id, "cellar-hatch");
  assert.equal(result.selected?.entityType, "feature");
});

test("movement searches exits rather than visible features or inventory", () => {
  const result = resolveSceneReference({ surface, action:"go down through the cellar hatch" });
  assert.equal(result.intent, "move");
  assert(result.pool.every((entry) => entry.entityType === "exit"));
  assert.equal(result.selected?.id, "exit:pantry:cellar");
});

test("speech searches present NPCs only", () => {
  const result = resolveSceneReference({ surface, action:"ask Tamsin about the room", mode:"speak" });
  assert(result.pool.every((entry) => entry.entityType === "npc"));
  assert.equal(result.selected?.id, "tamsin");
});
