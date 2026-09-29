import assert from "node:assert/strict";
import test from "node:test";
import { routeBetweenRooms } from "../src/map-routes.ts";
import { ADVENTURE_RULES } from "../server/adventure-rules.mjs";

const cellar={x:561,y:568,w:242,h:184};
const cellarPassage={x:836,y:584,w:154,h:144};
const mothglass={x:814,y:368,w:220,h:168};
const surveyPassage={x:572,y:784,w:418,h:112};

function crossesRoom(a,b,room) {
  if(a.x===b.x)return a.x>room.x&&a.x<room.x+room.w
    && Math.max(a.y,b.y)>room.y&&Math.min(a.y,b.y)<room.y+room.h;
  return a.y>room.y&&a.y<room.y+room.h
    && Math.max(a.x,b.x)>room.x&&Math.min(a.x,b.x)<room.x+room.w;
}

test("survey routes join room edges without cutting through nearby rooms",()=>{
  const route=routeBetweenRooms(mothglass,surveyPassage,[cellar,cellarPassage]);
  assert.equal(route.start.y,mothglass.y+mothglass.h);
  assert.equal(route.end.y,surveyPassage.y);
  for(let index=1;index<route.points.length;index++) {
    const a=route.points[index-1],b=route.points[index];
    assert.ok(a.x===b.x||a.y===b.y,"route stays orthogonal");
    assert.ok(!crossesRoom(a,b,cellar),"route clears cellar");
    assert.ok(!crossesRoom(a,b,cellarPassage),"route clears cellar passage");
  }
});

test("adjacent rooms share a short readable threshold route",()=>{
  const route=routeBetweenRooms(cellar,cellarPassage,[mothglass,surveyPassage]);
  assert.equal(route.start.x,cellar.x+cellar.w);
  assert.equal(route.end.x,cellarPassage.x);
  assert.ok(route.points.length<=5);
});

test("every authored adventure route avoids all other revealed room interiors",()=>{
  for(const adventure of ADVENTURE_RULES)for(const area of adventure.locations)for(const key of area.connectsTo) {
    const target=adventure.locations.find((room)=>room.key===key);
    if(!target)continue;
    const others=adventure.locations.filter((room)=>room!==area&&room!==target);
    const route=routeBetweenRooms(area,target,others);
    for(let index=1;index<route.points.length;index++)for(const room of others) {
      assert.ok(!crossesRoom(route.points[index-1],route.points[index],room),
        `${adventure.suffix}: ${area.key} → ${target.key} must avoid ${room.key}`);
    }
  }
});
