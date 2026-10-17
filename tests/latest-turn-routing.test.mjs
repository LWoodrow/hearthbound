import test from 'node:test';
import assert from 'node:assert/strict';
import {latestRouteRequest,calibratedLatestRouteRequest,validLatestRoute,latestActRequest,validLatestActs,resolvedLatestRoute} from '../scripts/lib/latest-turn-router.mjs';
import {latestFirstRequest} from '../scripts/lib/latest-first.mjs';
import {probeLatestRoutes} from '../scripts/probe-latest-turn-routing.mjs';
import {evaluateDialogue,scenarios} from '../scripts/evaluate-one-pass-dialogue.mjs';

test('latest-turn classifier has only fixed examples and newest speech, not live history or facts',()=>{
 const speech='Hello; where can I eat?';
 for(const build of [latestRouteRequest,calibratedLatestRouteRequest]){
  const request=build(speech);
  assert.equal(request.messages.at(-1).content,speech);
  assert.equal(request.schema.additionalProperties,false);
  assert.ok(request.generation.timeoutMs<=6000);
  assert.doesNotMatch(JSON.stringify(request),/Maren|priorThread|previouslySaid/);
 }
 assert.equal(validLatestRoute({route:'ordinary'}),true);
 for(const value of [null,[],{route:'invent-quest'},{route:'ordinary',effect:'unlock'}])assert.equal(validLatestRoute(value),false);
});

test('act decomposition cannot silently omit punctuation or a substantive question',()=>{
 const speech='Hello! Where is the inn?';
 const complete={acts:[{words:'Hello!',route:'greeting'},{words:'Where is the inn?',route:'ordinary'}]};
 assert.equal(validLatestActs(complete,speech),true);
 assert.equal(resolvedLatestRoute(complete,speech),'ordinary');
 assert.equal(validLatestActs({acts:[{words:'Hello',route:'greeting'}]},speech),false);
 assert.equal(validLatestActs({acts:[{words:'Hello',route:'greeting'}]},'Hello!'),false);
 assert.throws(()=>resolvedLatestRoute({acts:[]},speech),{code:'invalid-output'});
 assert.equal(latestActRequest(speech).schema.properties.acts.items.properties.words.maxLength,240);
});

test('probe distinguishes format validity from semantic agreement and transport failure',async()=>{
 let calls=0;
 const result=await probeLatestRoutes({profile:{displayName:'fake'},emit:()=>{},cases:[
  {speech:'Hello!',expected:['greeting']},{speech:'Food?',expected:['ordinary']},{speech:'Stop.',expected:['end']},
 ],generate:async()=>{if(++calls===3)throw Error('offline');return {route:'greeting'};}});
 assert.equal(calls,3);assert.equal(result.summary.valid,2);assert.equal(result.summary.matched,1);
 assert.equal(result.turns[2].error,'offline');assert.equal(result.turns[2].route,null);
});

function source(speech){return {kind:'npc-dialogue',generation:{timeoutMs:45000},messages:[
 {role:'system',content:'original'},
 {role:'user',content:'Tell a grand romantic tale.'},
 {role:'assistant',content:JSON.stringify({previouslySaid:'Maren and the button. Shall I tell more?',utteranceKind:'speech'})},
 {role:'user',content:JSON.stringify({player:{name:'Nigel'},newestPlayerSpeech:speech,sources:{established:{character:{name:'Nima'},facts:['The Last Lantern is nearby.']}},conversationJournal:{priorThread:{request:'Tell a tale',choices:['romance'],move:'clarify'}}})},
 ]};}

test('new greetings and ordinary questions cannot inherit story context; route is binding',async()=>{
 for(const route of ['greeting','ordinary']){
  let calls=0;const request=source(route==='greeting'?'Hello!':'Where can I eat?');
  const original=JSON.stringify(request);
  const result=await latestFirstRequest(request,async next=>{
   calls++;
   if(calls===1){assert.doesNotMatch(JSON.stringify(next),/Maren|button|romance/);return {route};}
   if(calls===2){
    assert.deepEqual(next.schema.properties.mode.enum,[route==='greeting'?'greet':'reply']);
    assert.doesNotMatch(JSON.stringify(next.messages),/Maren|button|romance|grand romantic/);
    return {mode:route==='greeting'?'greet':'reply',goal:route==='greeting'?'Greet Nigel':'Suggest a nearby venue',preferences:[],selectedFacts:route==='greeting'?[]:['f0']};
   }
   assert.doesNotMatch(JSON.stringify(next.messages),/Maren|button|romance/);
   return {reply:route==='greeting'?'Hello, Nigel.':'Try the Last Lantern nearby.'};
  });
  assert.equal(calls,3);assert.equal(result.kind,'speech');assert.deepEqual(result.thread.choices,[]);
  assert.equal(JSON.stringify(request),original);
 }
 let calls=0;
 await assert.rejects(()=>latestFirstRequest(source('Hello!'),async()=>++calls===1?{route:'greeting'}:{mode:'tell-fiction',goal:'Story',preferences:[],selectedFacts:[]}),{code:'invalid-output'});
 assert.equal(calls,2);
});

test('continuations retain the exchange; invalid routing and repair requests stop without retries',async()=>{
 let calls=0;
 await latestFirstRequest(source('Go on.'),async next=>{
  if(++calls===1)return {route:'continuation'};
  if(calls===2){assert.match(JSON.stringify(next.messages),/Maren|button/);return {mode:'tell-fiction',goal:'Deliver the imagined tale',preferences:['grand scale'],selectedFacts:[]};}
  return {reply:'An imagined tale: two strangers found a bell and rang it until the lost ships came home.'};
 });assert.equal(calls,3);
 calls=0;await assert.rejects(()=>latestFirstRequest(source('Hello!'),async()=>{calls++;return {route:'world-action'};}),{code:'invalid-output'});assert.equal(calls,1);
 await assert.rejects(()=>latestFirstRequest({...source('Hello!'),kind:'npc-dialogue-repair'},async()=>assert.fail('No repair calls')),{code:'invalid-output'});
});

test('memory-only replay counts all three calls and retains no canonical effect',async()=>{
 let calls=0;
 const result=await evaluateDialogue({profile:{id:'test',model:'test',contextTokens:8192},scenario:scenarios['nima-brass'],limit:1,requestPipeline:latestFirstRequest,emit:()=>{},generate:async()=>{
  calls++;
  if(calls===1)return {route:'greeting'};
  if(calls===2)return {mode:'greet',goal:'Greet Nigel',preferences:[],selectedFacts:[]};
  return {reply:'Hello, Nigel.'};
 }});
 assert.equal(calls,3);assert.equal(result.summary.totalCalls,3);
 assert.equal(result.summary.canonicalChanges,0);
 assert.equal(result.turns[0].utteranceKind,'speech');assert.equal(result.turns[0].conversationThread.move,'respond');
});
