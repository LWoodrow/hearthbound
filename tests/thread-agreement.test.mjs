import test from 'node:test';
import assert from 'node:assert/strict';
import {threadAgreementRequest} from '../scripts/lib/thread-agreement.mjs';
import {threadFirstRequest} from '../scripts/lib/thread-first.mjs';
import {evaluateDialogue,scenarios} from '../scripts/evaluate-one-pass-dialogue.mjs';

function request(){return {kind:'npc-dialogue',schema:{type:'object'},generation:{numPredict:360,timeoutMs:45000},messages:[
 {role:'system',content:'Original instructions'},
 {role:'user',content:'Tell an imaginary tale.'},
 {role:'assistant',content:JSON.stringify({previouslySaid:'Which mood?',utteranceKind:'speech',authority:'unverified-dialogue-only'})},
 {role:'user',content:JSON.stringify({player:{name:'Nigel'},sources:{established:{character:{name:'Nima'},facts:['Maren mends clothes.']},limits:{conversation:'Not canon'}},conversationJournal:{priorThread:{request:'Tell a tale',choices:['romance'],move:'clarify'}},reads:[{id:'k0'}],socialGoals:[],newestPlayerSpeech:'You decide.'})},
]};}
test('compact frame removes duplicate history while preserving current facts, tools and newest speech',()=>{
 const original=request(),copy=JSON.stringify(original),compact=threadAgreementRequest(original);
 assert.equal(compact.messages.length,2);assert.equal(compact.schema,original.schema);
 const data=JSON.parse(compact.messages[1].content);
 assert.equal(data.dialogueOnly.history.length,1);assert.equal(data.dialogueOnly.history[0].npc,'Which mood?');
 assert.equal(data.newestPlayerSpeech,'You decide.');assert.deepEqual(data.currentSources.facts,['Maren mends clothes.']);
 assert.equal(data.reads[0].id,'k0');assert.equal(compact.generation.numPredict,300);assert.equal(JSON.stringify(original),copy);
});
test('one semantic mode determines persisted kind and move; writer can only supply words',async()=>{
 const calls=[];
 const output=await threadFirstRequest(request(),async next=>{
  calls.push(next);if(calls.length===1)return {mode:'tell-fiction',goal:'Tell a romantic tale',preferences:['romance','NPC chooses details']};
  const input=JSON.parse(next.messages[1].content);
  assert.equal(input.dialoguePlan.kind,'fiction');assert.equal(input.dialoguePlan.move,'deliver');assert.deepEqual(input.dialoguePlan.choices,['romance','NPC chooses details']);
  assert.deepEqual(next.schema.required,['reply']);assert.equal(next.schema.additionalProperties,false);
  return {reply:'Here is an imagined tale: two travellers met across an ocean and found their way home together.'};
 });
 assert.equal(calls.length,2);assert.equal(output.kind,'fiction');assert.equal(output.thread.move,'deliver');assert.deepEqual(output.ids,[]);assert.equal(output.approach,'');
 assert.ok(calls[0].generation.timeoutMs<=8000);assert.ok(calls[1].generation.timeoutMs<=12000);
});
test('invalid plans stop before writing; invalid drafts and implicit repair pipelines are rejected',async()=>{
 for(const mode of ['invented','social','read']){let calls=0;await assert.rejects(()=>threadFirstRequest(request(),async()=>{calls++;return {mode,goal:'invent a quest',preferences:[]};}),{code:'invalid-output'});assert.equal(calls,1);}
 let calls=0;await assert.rejects(()=>threadFirstRequest(request(),async()=>++calls===1?{mode:'reply',goal:'Answer',preferences:[]}:{reply:'You now have a key.'}));assert.equal(calls,2);
 await assert.rejects(()=>threadFirstRequest({...request(),kind:'npc-dialogue-repair'},async()=>assert.fail('No repair chain')));
});
test('requested repeat reuses eligible words and keeps fiction provenance without a writer call',async()=>{
 const original=request();const text='Here is an imagined tale about two travellers.';
 original.messages[2].content=JSON.stringify({previouslySaid:text,utteranceKind:'fiction'});
 let calls=0;const output=await threadFirstRequest(original,async()=>{calls++;return {mode:'repeat',goal:'Repeat the tale',preferences:[]};});
 assert.equal(calls,1);assert.equal(output.kind,'fiction');assert.equal(output.thread.move,'repeat');assert.equal(output.reply,text);
 original.messages[2].content=JSON.stringify({previouslySaid:'[Earlier knowledge is no longer available.]'});
 await assert.rejects(()=>threadFirstRequest(original,async()=>({mode:'repeat',goal:'Repeat',preferences:[]})));
});
test('actual memory-only dispatch counts both inferences and persists their shared plan atomically',async()=>{
 let calls=0;
 const result=await evaluateDialogue({profile:{id:'test',model:'test',contextTokens:8192},scenario:scenarios['nima-fiction'],limit:1,requestPipeline:threadFirstRequest,emit:()=>{},generate:async()=>++calls===1?{mode:'tell-fiction',goal:'Tell a tale',preferences:['NPC chooses']}:{reply:'Here is an imagined tale: two strangers crossed a sea, found each other and returned home.'}});
 assert.equal(calls,2);assert.equal(result.summary.totalCalls,2);assert.equal(result.summary.canonicalChanges,0);
 assert.equal(result.turns[0].utteranceKind,'fiction');assert.equal(result.turns[0].conversationThread.move,'deliver');
});
