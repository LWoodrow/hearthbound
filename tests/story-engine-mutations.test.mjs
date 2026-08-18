import test from "node:test";
import assert from "node:assert/strict";
import { validateAdventure } from "../server/adventure-schema.mjs";
import { lanternBelowAdventure } from "../server/adventures/lantern-below.mjs";

test("mutation validation catches lost discoveries, unknown state targets, and impossible prerequisites",()=>{
  const unknownDiscovery=structuredClone(lanternBelowAdventure);
  unknownDiscovery.interactions[0].effects=[{op:"add",path:"discoveries",value:"invented-clue"}];
  assert.ok(validateAdventure(unknownDiscovery).errors.some((error)=>error.includes("unknown discovery")));
  const unknownObject=structuredClone(lanternBelowAdventure);
  unknownObject.interactions[0].effects=[{op:"set",path:"objects.phantom.open",value:true}];
  assert.ok(validateAdventure(unknownObject).errors.some((error)=>error.includes("unknown object")));
  const impossible=structuredClone(lanternBelowAdventure);
  impossible.interactions[0].requires=[{path:"flags.neverProduced",equals:true}];
  assert.ok(validateAdventure(impossible).errors.some((error)=>error.includes("impossible prerequisite")));
});
