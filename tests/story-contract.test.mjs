import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryContractProbe,validStorySpec} from '../scripts/lib/story-contract.mjs';
import {evaluateDialogue,scenarios} from '../scripts/evaluate-one-pass-dialogue.mjs';

const story=(overrides={})=>({subject:'a brass bell',genre:'romance',tone:'hopeful',scale:'epic journey',ending:'reunion',...overrides});
const empty=()=>story(Object.fromEntries(['subject','genre','tone','scale','ending'].map(key=>[key,''])));
function request(speech='Tell it.',overrides={}){return {kind:'npc-dialogue',generation:{timeoutMs:45000},messages:[
 {role:'system',content:'original'},
 {role:'user',content:'Tell a romantic tale.'},
 {role:'assistant',content:JSON.stringify({previouslySaid:'Shall I choose a subject?',utteranceKind:'speech'})},
 {role:'user',content:JSON.stringify({player:{name:'Nigel'},sources:{established:{character:{name:'Nima',voice:'gentle',life:{family:'Maren is her sister.'}},facts:['The Last Lantern is nearby.'],place:{name:'Returners Wall'}},limits:{}},conversationJournal:{priorThread:null},newestPlayerSpeech:speech,...overrides})},
 ]};}
const accept=(probe,source,output)=>probe.afterTurn({text:JSON.parse(source.messages.at(-1).content).newestPlayerSpeech,reply:output.reply,utteranceKind:output.kind,conversationThread:output.thread,status:{unavailable:false}});

test('story specification separates subject, genre, tone, narrative scale and ending',()=>{
 assert.equal(validStorySpec(story()),true);
 for(const value of [null,[],{...story(),speaker:'Nima'},story({scale:7}),story({subject:'x'.repeat(121)})])assert.equal(validStorySpec(value),false);
});

test('accepted story dimensions survive continuation and revision without leaking biography',async()=>{
 const probe=createStoryContractProbe(),source=request();let calls=0;
 const first=await probe.requestPipeline(source,async next=>{
  if(++calls===1)return {move:'tell',topic:'Tell an epic romantic tale about a brass bell',story:story(),selectedFacts:[]};
  const context=JSON.parse(next.messages[1].content);
  assert.deepEqual(context.imaginedStory,story());assert.doesNotMatch(JSON.stringify(context),/Maren|Last Lantern/);
  return {reply:'Two strangers followed the imagined bell across distant seas and found one another at last.'};
 });
 assert.equal(calls,2);assert.match(first.reply,/^An imagined tale: /);
 assert.equal(probe.snapshot().active,null,'proposal is not yet accepted');
 assert.equal(accept(probe,source,first).committed,true);assert.deepEqual(probe.snapshot().active,story());
 const exposed=probe.snapshot();exposed.active.subject='tampered';assert.deepEqual(probe.snapshot().active,story());
 calls=0;
 const revision=request('Make the ending sadder.');
 revision.messages[2].content=JSON.stringify({previouslySaid:first.reply,utteranceKind:'fiction'});
 const revised=await probe.requestPipeline(revision,async next=>{
  if(++calls===1){const context=JSON.parse(next.messages[1].content);assert.deepEqual(context.acceptedStoryTask,story());assert.deepEqual(context.recentPlayerWords,[]);assert.equal(context.previousUtterance.speaker,'Nima');assert.equal(context.previousUtterance.listener,'Nigel');assert.equal(context.previousUtterance.kind,'fiction');assert.equal(context.previousUtterance.words,undefined);return {move:'revise',topic:'Revise only the ending',story:story({ending:'parting'}),selectedFacts:[]};}
  const context=JSON.parse(next.messages[1].content);assert.match(context.previousFiction,/distant seas/);assert.equal(context.imaginedStory.subject,'a brass bell');return {reply:'They followed the same bell, but the tide kept the lovers on opposite shores.'};
 });
 assert.equal(accept(probe,revision,revised).committed,true);assert.equal(probe.snapshot().active.ending,'parting');assert.equal(calls,2);
});

test('factual subject change gets ownership metadata, no tale or personal anecdote, and clears active story',async()=>{
 const probe=createStoryContractProbe(),first=request();
 const output=await probe.requestPipeline(first,async next=>next.kind==='npc-story-contract'?{move:'tell',topic:'A brass romance',story:story(),selectedFacts:[]}:{reply:'The bell brought two imaginary lovers together.'});
 accept(probe,first,output);
 const source=request('Was that a real experience of yours?');let calls=0;
 source.messages[2].content=JSON.stringify({previouslySaid:output.reply,utteranceKind:'fiction'});
 const factual=await probe.requestPipeline(source,async next=>{
  if(++calls===1)return {move:'chat',topic:'Explain whether the previous story was real',story:empty(),selectedFacts:[]};
  const context=JSON.parse(next.messages[1].content);assert.deepEqual(context.previousUtterance,{speaker:'Nima',listener:'Nigel',kind:'fiction'});
  assert.equal(context.imaginedStory,undefined);assert.doesNotMatch(JSON.stringify(context),/imaginary lovers|Maren/);
  return {reply:'That was an imagined tale I told you, not something I lived through.'};
 });
 assert.equal(factual.kind,'speech');accept(probe,source,factual);assert.equal(probe.snapshot().active,null);assert.ok(probe.snapshot().lastStory);
});

test('failed output or unaccepted reply cannot commit or overwrite accepted story notes',async()=>{
 const probe=createStoryContractProbe(),source=request();
 const output=await probe.requestPipeline(source,async next=>next.kind==='npc-story-contract'?{move:'tell',topic:'A tale',story:story(),selectedFacts:[]}:{reply:'An imaginary bell guided a sailor safely home.'});
 const before=probe.snapshot();
 assert.equal(probe.afterTurn({text:'different words',reply:output.reply,utteranceKind:'fiction',conversationThread:output.thread,status:{}}).committed,false);assert.deepEqual(probe.snapshot(),before);
 await assert.rejects(()=>probe.requestPipeline(source,async next=>next.kind==='npc-story-contract'?{move:'tell',topic:'A tale',story:story(),selectedFacts:[]}:{reply:'You now have a key.'}),{code:'invalid-output'});
 assert.equal(accept(probe,source,output).committed,false);assert.deepEqual(probe.snapshot(),before);
 const again=await probe.requestPipeline(source,async next=>next.kind==='npc-story-contract'?{move:'tell',topic:'A tale',story:story(),selectedFacts:[]}:{reply:'The imagined bell led the sailor home.'});
 assert.equal(probe.afterTurn({text:'Tell it.',reply:again.reply,utteranceKind:'fiction',conversationThread:again.thread,status:{unavailable:true}}).committed,false);
});

test('repeat reuses the accepted NPC utterance and fiction label without a writer',async()=>{
 const probe=createStoryContractProbe(),source=request();
 const first=await probe.requestPipeline(source,async next=>next.kind==='npc-story-contract'?{move:'tell',topic:'A tale',story:story(),selectedFacts:[]}:{reply:'A bell rang out for a lost traveller.'});accept(probe,source,first);
 let calls=0;const repeat=request('Repeat that.');
 repeat.messages[2].content=JSON.stringify({previouslySaid:first.reply,utteranceKind:'fiction'});
 const output=await probe.requestPipeline(repeat,async()=>{calls++;return {move:'repeat',topic:'Repeat the tale',story:empty(),selectedFacts:[]};});
 assert.equal(calls,1);assert.equal(output.reply,first.reply);assert.equal(output.kind,'fiction');accept(probe,repeat,output);assert.deepEqual(probe.snapshot().active,story());
 const withdrawn=request('Repeat that.');withdrawn.messages[2].content=JSON.stringify({previouslySaid:'[Earlier knowledge is no longer available.]',utteranceKind:'speech'});
 await assert.rejects(()=>probe.requestPipeline(withdrawn,async()=>({move:'repeat',topic:'Repeat',story:empty(),selectedFacts:[]})),{code:'invalid-output'});
 await assert.rejects(()=>probe.requestPipeline(withdrawn,async()=>({move:'revise',topic:'Revise',story:story(),selectedFacts:[]})),{code:'invalid-output'});
});

test('invalid shape, unknown sources, missing revision, scope changes and repair chains stop',async()=>{
 for(const plan of [
  {move:'tell',topic:'A tale',story:story({subject:''}),selectedFacts:[]},
  {move:'chat',topic:'Food',story:empty(),selectedFacts:['private-secret']},
  {move:'revise',topic:'Change it',story:story(),selectedFacts:[]},
  {move:'chat',topic:'Food',story:empty(),selectedFacts:[],effect:'unlock'},
 ]){let calls=0;await assert.rejects(()=>createStoryContractProbe().requestPipeline(request(),async()=>{calls++;return plan;}),{code:'invalid-output'});assert.equal(calls,1);}
 const probe=createStoryContractProbe();
 await probe.requestPipeline(request(),async next=>next.kind==='npc-story-contract'?{move:'greet',topic:'Greet',story:empty(),selectedFacts:[]}:{reply:'Hello.'});
 await assert.rejects(()=>probe.requestPipeline(request('Hello',{player:{name:'Someone else'}}),async()=>assert.fail('No inference across scopes')),{code:'invalid-output'});
 await assert.rejects(()=>probe.requestPipeline({...request(),kind:'npc-dialogue-repair'},async()=>assert.fail('No repair chain')),{code:'invalid-output'});
});

test('memory-only replay counts two calls and accepts task notes only with the spoken event',async()=>{
 const result=await evaluateDialogue({profile:{id:'test',model:'test',contextTokens:8192},scenario:scenarios['nima-story-contract'],limit:1,harnessFactory:()=>createStoryContractProbe(),emit:()=>{},generate:async(profile,messages,schema)=>schema.required.includes('story')?{move:'tell',topic:'A romance',story:story(),selectedFacts:[]}:{reply:'Two imaginary sailors followed a brass bell and found each other.'}});
 assert.equal(result.summary.totalCalls,2);assert.equal(result.summary.canonicalChanges,0);assert.equal(result.turns[0].storyContract.committed,true);
 assert.deepEqual(result.turns[0].storyContract.state.active,story());assert.equal(result.turns[0].utteranceKind,'fiction');
});
