import assert from "node:assert/strict";
import test from "node:test";
import { visibleNpcPortraits,NPC_PORTRAIT_FILES,NPC_PORTRAIT_CROPS } from "../shared/portrait-catalogue.mjs";
import roads from "../server/adventures/eldervale-roads.mjs";
import {readFileSync} from "node:fs";
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
  for(const portraitId of ["__proto__","constructor","toString"]){
    assert.deepEqual(visibleNpcPortraits({story:{npcs:{stranger:{name:"Stranger",portraitId}}}},[{speaker:"Stranger"}]),{});
  }
});

test("all authored resident portraits are local assets and reveal only after that resident appears",()=>{
  assert.deepEqual(visibleNpcPortraits(roads,[]),{});
  for(const npc of Object.values(roads.story.npcs).filter(npc=>npc.portraitId)) {
    assert.deepEqual(visibleNpcPortraits(roads,[{speaker:npc.name}]),{[npc.name]:npc.portraitId});
    const file=NPC_PORTRAIT_FILES[npc.portraitId] || NPC_PORTRAIT_CROPS[npc.portraitId]?.file;
    const asset=readFileSync(new URL("../public"+file,import.meta.url));
    assert.equal(asset.subarray(1,4).toString(),"PNG");
  }
  const source=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  assert.match(source,/npcPortraitStyle\(npcId\)/);
  assert.match(source,/style=\{npcStyle\}/);
});
