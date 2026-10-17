import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersonalStoryLedger,storyProposal} from '../server/npc-personal-stories.mjs';
import {createPersonalStoryProbe} from '../scripts/lib/personal-story-probe.mjs';
import {evaluateDialogue} from '../scripts/evaluate-one-pass-dialogue.mjs';
import {probeContext,probeCases} from '../scripts/probe-dialogue-format.mjs';
import {onePassMessages,onePassSchema} from '../server/npc-one-pass.mjs';

const scope={partyId:'party',adventureId:'adventure',npcId:'npc'};
const policy={ownerName:'Nima Dawnstone',people:[{id:'sister',name:'Maren'}],places:[{id:'last',name:'The Last Lantern'},{id:'bakery',name:'Hearthcrumb Bakery'}],limit:2};
const proposal={personId:'sister',placeId:'last',activity:'talked',impression:'amusing',topic:'mending'};
const reply='Maren and I talked about mending at the Last Lantern. It was amusing.';
const create=()=>({story:{kind:'create',...proposal},reply});
const profile={id:'test',version:1,model:'test',contextTokens:8192};
function request(){const context=probeContext(probeCases.family);return {kind:'npc-dialogue',schema:onePassSchema(context),messages:onePassMessages(context,'Have you visited with Maren?'),generation:{numPredict:240,timeoutMs:45000}};}
const published=text=>({speaker:policy.ownerName,reply:text,status:{source:'ai-dialogue'},canonicalUnchanged:true});

test('personal story preview has no effect; commit has bounded fields and explicit noncanonical provenance',()=>{
 const ledger=createPersonalStoryLedger(),draft=ledger.preview(scope,policy,proposal);
 assert.equal(draft.verified,false);assert.equal(draft.provenance,'improvised-personal');assert.equal(draft.era,'before-this-adventure');
 assert.deepEqual(ledger.snapshot(),[]);assert.equal(ledger.view(scope,policy,'player').length,0);
 const stored=ledger.commit(scope,policy,proposal,'player');assert.equal(stored.id,'s1');assert.equal(ledger.view(scope,policy,'player').length,1);
 assert.deepEqual(storyProposal(stored),proposal);assert.equal(stored.effects,undefined);assert.equal(stored.reply,undefined);
 const copy=ledger.snapshot();copy[0].stories[0].placeId='forged';assert.equal(ledger.snapshot()[0].stories[0].placeId,'last');
});

test('only reviewed companions, places and safe typed activities can enter personal memory',()=>{
 const ledger=createPersonalStoryLedger();
 for(const bad of [{...proposal,personId:'unknown-relative'},{...proposal,placeId:'hidden-vault'},{...proposal,activity:'give-equipment'},{...proposal,impression:'quest-complete'},{...proposal,topic:'unlock-gate'},{...proposal,effects:['grant key']},{...proposal,summary:'A king promoted me'},{...proposal,when:'now'}])assert.throws(()=>ledger.commit(scope,policy,bad,'player'),/Invalid/);
 assert.deepEqual(ledger.snapshot(),[]);
 assert.throws(()=>ledger.preview({...scope,playerId:'wrong-scope-field'},policy,proposal),/scope/);
 assert.throws(()=>ledger.preview(scope,{...policy,places:[...policy.places,policy.places[0]]},proposal),/references/);
});

test('repeated stories are idempotent and conflicts cannot overwrite an already told visit',()=>{
 const ledger=createPersonalStoryLedger();ledger.commit(scope,policy,proposal,'one');ledger.commit(scope,policy,proposal,'one');
 assert.equal(ledger.view(scope,policy,'one').length,1);assert.equal(ledger.snapshot()[0].stories[0].heardBy.length,1);
 assert.throws(()=>ledger.commit(scope,policy,{...proposal,impression:'awkward'},'one'),/cannot be overwritten/);
 assert.equal(ledger.view(scope,policy,'one')[0].impression,'amusing');
 ledger.commit(scope,policy,{...proposal,placeId:'bakery'},'one');assert.equal(ledger.view(scope,policy,'one').length,2);
});

test('memory capacity does not evict old stories; existing stories remain recallable when full',()=>{
 const ledger=createPersonalStoryLedger(),small={...policy,limit:1};ledger.commit(scope,small,proposal,'one');
 assert.throws(()=>ledger.commit(scope,small,{...proposal,placeId:'bakery'},'one'),/full/);
 ledger.recall(scope,small,'s1','two');assert.equal(ledger.view(scope,small,'two')[0].toldToThisPlayer,true);
 assert.throws(()=>ledger.recall(scope,small,'missing','two'),/Unknown/);
});

test('story ownership is scoped by party/adventure/NPC while listener history is private',()=>{
 const ledger=createPersonalStoryLedger();ledger.commit(scope,policy,proposal,'one');
 for(const other of [{...scope,partyId:'other'},{...scope,adventureId:'other'},{...scope,npcId:'other'}])assert.deepEqual(ledger.view(other,policy,'one'),[]);
 const shared=ledger.view(scope,policy,'two');assert.equal(shared.length,1);assert.equal(shared[0].toldToThisPlayer,false);
 assert.equal(shared[0].heardBy,undefined);assert.doesNotMatch(JSON.stringify(shared),/"one"/);
 ledger.recall(scope,policy,'s1','two');assert.equal(ledger.view(scope,policy,'two')[0].toldToThisPlayer,true);
 assert.equal(ledger.view(scope,policy,'one')[0].id,ledger.view(scope,policy,'two')[0].id);
});

test('snapshot restoration validates provenance and is atomic on corrupt or duplicate records',()=>{
 const ledger=createPersonalStoryLedger();ledger.commit(scope,policy,proposal,'one');
 const snapshot=ledger.snapshot(),restored=createPersonalStoryLedger();restored.restore(snapshot);assert.deepEqual(restored.snapshot(),snapshot);
 const corruptions=[
  data=>{data[0].stories[0].verified=true;},
  data=>{data[0].stories[0].effects=['grant key'];},
  data=>{data[0].stories[0].placeId='secret';},
  data=>{data[0].stories[0].provenance='canonical';},
  data=>{data.push(structuredClone(data[0]));},
  data=>{data[0].stories.push({...data[0].stories[0],id:'s2'});},
 ];
 for(const corrupt of corruptions){const bad=structuredClone(snapshot);corrupt(bad);assert.throws(()=>restored.restore(bad));assert.deepEqual(restored.snapshot(),snapshot);}
});

test('an authored policy change needs explicit migration instead of silently rewriting remembered people',()=>{
 const ledger=createPersonalStoryLedger();ledger.commit(scope,policy,proposal,'one');
 assert.throws(()=>ledger.view(scope,{...policy,people:[{id:'sister',name:'Another name'}]},'one'),/migration/);
});

test('unpublished drafts, stale/changed scenes and filtered offers cannot enter personal memory',()=>{
 for(const turn of [{...published(reply),status:{source:'authored-fallback',unavailable:true}},{...published(reply),canonicalUnchanged:false},{...published(reply),speaker:'Dungeon Master'},{...published(reply),reply:'A different reply.'}]){
  const probe=createPersonalStoryProbe({scope,playerId:'one',policy});probe.transformRequest(request()).decode(create());
  const result=probe.afterTurn(turn);assert.equal(result.committed,false);assert.deepEqual(probe.snapshot(),[]);
 }
});

test('a model cannot store an unspoken story merely by adding invisible metadata to a greeting',()=>{
 const probe=createPersonalStoryProbe({scope,playerId:'one',policy}),adapted=probe.transformRequest(request());
 adapted.decode({...create(),reply:'Hello, nice to see you.'});
 const result=probe.afterTurn(published('Hello, nice to see you.'));assert.equal(result.reason,'story-not-mentioned');assert.equal(result.committed,false);assert.deepEqual(probe.snapshot(),[]);
 adapted.decode(create());assert.equal(probe.afterTurn(published(reply)).committed,true);
 assert.equal(probe.afterTurn(published(reply)).committed,false,'publication callback cannot commit twice');
});

test('prototype schema removes creation when full and rejects arbitrary prose fields or capabilities',()=>{
 const small={...policy,limit:1},probe=createPersonalStoryProbe({scope,playerId:'one',policy:small});
 probe.transformRequest(request()).decode(create());probe.afterTurn(published(reply));
 const next=probe.transformRequest(request());assert.equal(next.schema.oneOf.length,2);
 assert.deepEqual(next.schema.oneOf.map(branch=>branch.properties.story.properties.kind.enum[0]),['none','recall']);
 assert.throws(()=>next.decode({...create(),effects:['grant key']}),/Invalid/);
 assert.throws(()=>next.decode({story:{kind:'recall',id:'forged'},reply}),/Invalid/);
 const forbidden=request(),data=JSON.parse(forbidden.messages.at(-1).content);data.reads=[{id:'k0'}];forbidden.messages.at(-1).content=JSON.stringify(data);
 assert.throws(()=>probe.transformRequest(forbidden),/scope/);
});

test('an optional conflicting story is discarded without blocking speech, retrying or overwriting memory',()=>{
 const probe=createPersonalStoryProbe({scope,playerId:'one',policy});probe.transformRequest(request()).decode(create());probe.afterTurn(published(reply));
 const next=probe.transformRequest(request()),conflict={story:{kind:'create',...proposal,impression:'awkward'},reply:'Maren and I visited the Last Lantern.'};
 assert.equal(next.decode(conflict).reply,conflict.reply);assert.equal(next.audit(conflict).memoryRejection,'story-conflict');
 const result=probe.afterTurn(published(conflict.reply));assert.equal(result.committed,false);assert.equal(result.reason,'story-conflict');assert.equal(result.stories[0].impression,'amusing');
});

test('accepted personal story survives export/import without treating it as a verified encounter',()=>{
 const first=createPersonalStoryProbe({scope,playerId:'one',policy});first.transformRequest(request()).decode(create());first.afterTurn(published(reply));
 const second=createPersonalStoryProbe({scope,playerId:'two',policy});second.restore(first.snapshot());
 const adapted=second.transformRequest(request());assert.match(adapted.messages[0].content,/improvised-personal/);assert.match(adapted.messages[0].content,/"verified":false/);
 adapted.decode({story:{kind:'recall',id:'s1'},reply});const result=second.afterTurn(published(reply));assert.equal(result.stories[0].toldToThisPlayer,true);
 assert.equal(result.stories[0].provenance,'improvised-personal');assert.equal(result.stories[0].verified,false);
});

test('actual dispatch remembers a typed story beyond the six-turn dialogue window with no canonical effects',async()=>{
 let harness,index=0;
 const original='Maren and I talked about mending at the Last Lantern. It was amusing.';
 const scenario={location:'city-delvers-memorial',turns:['Tell me a personal story.',...Array(7).fill('Let us change the subject for a bit.'),'Where was that earlier visit with Maren?']};
 const result=await evaluateDialogue({profile,scenario,emit:()=>{},harnessFactory:({partyId,adventureId,playerId})=>{
  harness=createPersonalStoryProbe({scope:{partyId,adventureId,npcId:'city-delvers-memorial-resident'},playerId,policy});return harness;
 },generate:async(_profile,messages)=>{
  const current=index++;
  if(current===0)return create();
  if(current===8){
   assert.ok(!messages.some(message=>message.role==='assistant'&&message.content===original),'old spoken line is outside recent chat');
   assert.match(messages[0].content,/"personalStories":\[\{"id":"s1"/);return {story:{kind:'recall',id:'s1'},reply:'Maren and I were at the Last Lantern, talking about mending.'};
  }
  return {story:{kind:'none'},reply:'Ordinary company is welcome.'};
 }});
 assert.equal(result.summary.turns,9);assert.equal(result.summary.totalCalls,9);assert.equal(result.summary.canonicalChanges,0);assert.equal(result.summary.unavailableTurns,0);
 assert.equal(harness.snapshot()[0].stories.length,1);assert.equal(result.turns.at(-1).personalMemory.reason,'recalled');
});

test('real final physical-offer guard prevents an otherwise valid story draft from being committed',async()=>{
 let harness;
 const result=await evaluateDialogue({profile,scenario:{location:'city-delvers-memorial',turns:['Tell me about a visit with Maren.']},emit:()=>{},harnessFactory:({partyId,adventureId,playerId})=>{
  harness=createPersonalStoryProbe({scope:{partyId,adventureId,npcId:'city-delvers-memorial-resident'},playerId,policy});return harness;
 },generate:async()=>({...create(),reply:reply+' Follow me.'})});
 assert.equal(result.summary.totalCalls,1);assert.equal(result.summary.unavailableTurns,1);assert.equal(result.summary.canonicalChanges,0);
 assert.equal(result.turns[0].status.reason,'physical-offer-claim');assert.equal(result.turns[0].personalMemory.reason,'not-published');assert.deepEqual(harness.snapshot(),[]);
});
