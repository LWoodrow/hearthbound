import assert from "node:assert/strict";
import test from "node:test";
import { visibleNpcPortraits } from "../shared/portrait-catalogue.mjs";
import { lanternBelowAdventure } from "../server/adventures/lantern-below.mjs";

test("NPC portraits are revealed only after that character speaks in visible history",()=>{
  const afterTamsin=visibleNpcPortraits(lanternBelowAdventure,[{speaker:"Tamsin Reed"}]);
  assert.deepEqual(afterTamsin,{"Tamsin Reed":"tamsin"});
  assert.ok(!Object.hasOwn(afterTamsin,"Mara Vey"));
  const afterMara=visibleNpcPortraits(lanternBelowAdventure,[{speaker:"Tamsin Reed"},{speaker:"Mara Vey"}]);
  assert.deepEqual(afterMara,{"Tamsin Reed":"tamsin","Mara Vey":"mara"});
});

test("unapproved portrait IDs cannot be sent to the player",()=>{
  const definition={story:{npcs:{stranger:{name:"Stranger",portraitId:"future-villain"}}}};
  assert.deepEqual(visibleNpcPortraits(definition,[{speaker:"Stranger"}]),{});
});
