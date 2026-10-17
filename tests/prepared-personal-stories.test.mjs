import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersonalStoryLedger} from '../server/npc-personal-stories.mjs';
import {createPreparedStoryProbe} from '../scripts/lib/prepared-story-probe.mjs';
import {evaluateDialogue} from '../scripts/evaluate-one-pass-dialogue.mjs';
import {probeContext,probeCases} from '../scripts/probe-dialogue-format.mjs';
import {onePassMessages} from '../server/npc-one-pass.mjs';

const scope={partyId:'party',adventureId:'adventure',npcId:'npc'};
const policy={ownerName:'Nima Dawnstone',people:[{id:'sister',name:'Maren'}],places:[{id:'last',name:'The Last Lantern'},{id:'bakery',name:'Hearthcrumb Bakery'}],limit:2};
const story={personId:'sister',placeId:'last',activity:'talked',impression:'amusing',topic:'mending'};
const request=()=>({kind:'npc-dialogue',messages:onePassMessages(probeContext(probeCases.family),'Have you visited with Maren?'),generation:{numPredict:240}});

test('off-turn preparation creates stable soft fiction without fabricating a hearing receipt',()=>{
 const ledger=createPersonalStoryLedger();ledger.prepare(scope,policy,[story]);
 assert.deepEqual(ledger.snapshot()[0].stories[0].heardBy,[]);
 assert.equal(ledger.view(scope,policy,'player')[0].toldToThisPlayer,false);
 const original=ledger.snapshot();ledger.prepare(scope,policy,[story]);assert.deepEqual(ledger.snapshot(),original);
 const restored=createPersonalStoryLedger();restored.restore(original);assert.deepEqual(restored.snapshot(),original);
 restored.recall(scope,policy,'s1','player');assert.equal(restored.view(scope,policy,'player')[0].toldToThisPlayer,true);
 assert.equal(restored.view(scope,policy,'other')[0].toldToThisPlayer,false);
});

test('prepared batches validate atomically, preserve previous memory and enforce limits',()=>{
 const ledger=createPersonalStoryLedger();ledger.prepare(scope,policy,[story]);const original=ledger.snapshot();
 for(const batch of [[{...story,placeId:'bakery'},{...story,impression:'awkward'}],[{...story,placeId:'bakery',effects:['grant key']}],[{...story,personId:'stranger'}]]){
  assert.throws(()=>ledger.prepare(scope,policy,batch));assert.deepEqual(ledger.snapshot(),original);
 }
 const small={...policy,limit:1},empty=createPersonalStoryLedger();
 assert.throws(()=>empty.prepare(scope,small,[story,{...story,placeId:'bakery'}]),/full/);assert.deepEqual(empty.snapshot(),[]);
 empty.prepare(scope,small,[]);assert.deepEqual(empty.snapshot(),[]);
 assert.throws(()=>empty.prepare(scope,small,Array(13).fill(story)),/Invalid/);
});

test('prepared-story control supplies stable notes but has no per-turn memory creation tool',()=>{
 const probe=createPreparedStoryProbe({scope,playerId:'player',policy,stories:[story]}),before=probe.snapshot(),adapted=probe.transformRequest(request());
 assert.deepEqual(adapted.schema.required,['reply']);assert.equal(adapted.generation.numPredict,240);
 assert.match(adapted.messages[0].content,/"topic":"mending"/);
 assert.equal(adapted.messages.at(-1).content,'Have you visited with Maren?');
 assert.deepEqual(adapted.decode({reply:'Maren and I talked about mending at the Last Lantern.'}),{kind:'speech',reply:'Maren and I talked about mending at the Last Lantern.',ids:[],approach:''});
 assert.throws(()=>adapted.decode({reply:'Hello',story:{kind:'create'}}),/Invalid/);
 assert.equal(probe.afterTurn({}).reason,'prepared-read-only');assert.deepEqual(probe.snapshot(),before);
 const bad=request(),data=JSON.parse(bad.messages.at(-1).content);data.reads=[{id:'private'}];bad.messages.at(-1).content=JSON.stringify(data);
 assert.throws(()=>probe.transformRequest(bad),/not eligible/);
});

test('actual prepared-story dispatch keeps the same note beyond recent chat with one call per turn',async()=>{
 let harness,calls=0;
 const result=await evaluateDialogue({profile:{id:'test',version:1,model:'test',contextTokens:8192},scenario:{location:'city-delvers-memorial',turns:Array(9).fill('Hi Nima, how are you?')},harnessFactory:({partyId,adventureId,playerId})=>(harness=createPreparedStoryProbe({scope:{partyId,adventureId,npcId:'city-delvers-memorial-resident'},playerId,policy,stories:[story]})),generate:async(_profile,messages)=>{
  calls++;assert.match(messages[0].content,/"topic":"mending"/);return {reply:'I am well, thank you.'};
 },emit:()=>{}});
 assert.equal(calls,9);assert.ok(result.turns.every(turn=>turn.canonicalUnchanged&&turn.calls===1&&!turn.status.unavailable));
 assert.equal(harness.snapshot()[0].stories[0].heardBy.length,0);
 assert.equal(result.turns.at(-1).personalMemory.stories.length,1);
});

test('valid prepared-story prose is not certified as semantically faithful by its schema',()=>{
 const probe=createPreparedStoryProbe({scope,playerId:'player',policy,stories:[story]});
 const output=probe.transformRequest(request()).decode({reply:'Maren runs a bakery.'});
 assert.equal(output.reply,'Maren runs a bakery.');
 assert.equal(probe.snapshot()[0].stories[0].topic,'mending');
 // This deliberate failing-quality specimen documents the boundary: a plain
 // reply schema cannot prove biography truth, and must not be called a judge.
});
