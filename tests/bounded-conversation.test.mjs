import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationSession,conversationProgress} from '../server/npc-conversation-session.mjs';
import {generateStructured} from '../server/ai-transport.mjs';
import {createDatabase,createPlayer,getParty,selectAdventure,setPartyState,getPartyState,getPlayer,listVisibleEvents} from '../server/database.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import roads from '../server/adventures/eldervale-roads.mjs';
import {resolveAction} from '../server/dm.mjs';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const request={kind:'npc-natural-performance',generation:{timeoutMs:60000}};
const reject={decision:'revise',feedback:'Do not invent facts.',claims:[],lookupIds:[]};
test('one turn deadline is shared across stages rather than renewed for each call',async()=>{
 let clock=0,called=0;
 const session=createConversationSession({now:()=>clock,publish:false});
 const transport=async input=>{called++;assert.ok(input.generation.timeoutMs<=90000-clock);clock+=30000;return {};};
 await session.generate(request,transport);await session.generate(request,transport);
 await assert.rejects(session.generate(request,transport),error=>error.code==='conversation-time-limit');
 await assert.rejects(session.generate(request,transport));
 assert.equal(called,3);assert.equal(session.close().elapsedMs,90000);
});
test('a hung transport is aborted, bounded even if it ignores abort, and never retried',async()=>{
 let signal;
 const session=createConversationSession({budgetMs:25,publish:false});
 await assert.rejects(session.generate(request,async input=>{signal=input.generation.signal;return new Promise(()=>{});}),error=>error.code==='conversation-time-limit');
 assert.equal(signal.aborted,true);assert.equal(session.canRun(),false);
 await assert.rejects(session.generate(request,async()=>{assert.fail('must not retry');}));
 assert.equal(session.close().calls,1);
});
test('five-call budget reserves both writing and checking before allowing a repair',async()=>{
 const session=createConversationSession({publish:false});
 for(let i=0;i<4;i++)await session.generate(request,async()=>({}));
 assert.equal(session.canRun(2),false);assert.equal(session.canRun(1),true);
 await session.generate(request,async()=>({}));
 await assert.rejects(session.generate(request,async()=>({})),error=>error.code==='conversation-call-limit');session.close();
});
test('progress is isolated by party/player, has no prompts and clears at completion',async()=>{
 const session=createConversationSession({partyId:'one',playerId:'actor'});
 await session.generate(request,async()=>{
  assert.equal(conversationProgress('one','actor').stage,'writing');
  assert.equal(conversationProgress('two','actor'),null);assert.equal(conversationProgress('one','other'),null);
  assert.deepEqual(Object.keys(conversationProgress('one','actor')).sort(),['budgetMs','calls','elapsedMs','stage','startedAt']);return {};
 });session.close();assert.equal(conversationProgress('one','actor'),null);
});
test('provider transport receives caller cancellation for body processing as well as headers',async()=>{
 const controller=new AbortController();let received;
 const promise=generateStructured({provider:'llamacpp',baseUrl:'http://example.test',model:'test'},[],{}, {signal:controller.signal},async(_url,options)=>{
  received=options.signal;return {ok:true,json:()=>new Promise((_,reject)=>received.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))};
 });await new Promise(resolve=>setImmediate(resolve));controller.abort();await assert.rejects(promise,/aborted/);assert.equal(received.aborted,true);
});
function fixture(){
 const db=createDatabase(':memory:'),player=createPlayer(db,{partyId:'party-first-company',name:'Nigel',species:'Human',className:'Fighter'});
 selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');
 const state=createCanonicalState(roads,{currentLocation:'city-delvers-memorial'});setPartyState(db,player.partyId,'world:eldervale-roads',state);
 return {db,player,state,key:`npcDialogueStatus:eldervale-roads:${player.id}`,diagnostics:`npcDialogueDiagnostics:eldervale-roads:${player.id}`};
}
test('reported eat-before-descent turn stops at the shared deadline and saves failure diagnostics, not NPC history',async()=>{
 const f=fixture();let clock=0,calls=0;
 try{
  await resolveAction(f.db,getPlayer(f.db,f.player.id),'speak',"just intrigued nima, we're planning to journey down but wanted to eat first",{npcDialogueMode:'legacy',npcSessionOptions:{now:()=>clock},npcGenerate:async input=>{
   calls++;clock+=30000;
   if(input.kind==='npc-conversation-input')return {tool:'respond_social',scope:'social',focus:'Acknowledge eating before the descent.',reply:'The inn has free stew.'};
   if(input.kind==='npc-claim-review')return reject;
   return {reply:'The inn has free stew.',evidenceIds:[]};
  }});
  assert.equal(calls,3);assert.match(listVisibleEvents(f.db,f.player).at(-1).text,/took too long/);
  const status=getPartyState(f.db,f.player.partyId,f.key),diagnostics=getPartyState(f.db,f.player.partyId,f.diagnostics);
  assert.equal(status.failureKind,'conversation-time-limit');assert.equal(status.repaired,true);assert.equal(status.elapsedMs,90000);assert.equal(status.failedStage,'npc-natural-repair');
  assert.equal(diagnostics.stages.length,3);assert.equal(diagnostics.audits[0].feedback,'Do not invent facts.');
  assert.equal(getPartyState(f.db,f.player.partyId,`npcNaturalHistory:eldervale-roads:city-delvers-memorial-resident:${f.player.id}`),null);
  assert.deepEqual(getPartyState(f.db,f.player.partyId,'world:eldervale-roads'),f.state);assert.equal(conversationProgress(f.player.partyId,f.player.id),null);
 }finally{f.db.close();}
});
test('exhausted verification attempts retain both review failures and truthful repair status',async()=>{
 const f=fixture();let calls=0;
 try{
  await resolveAction(f.db,getPlayer(f.db,f.player.id),'speak','hi nima',{npcDialogueMode:'legacy',npcGenerate:async input=>{
   calls++;if(input.kind==='npc-conversation-input')return {tool:'respond_social',reply:'Hello.'};
   if(input.kind==='npc-claim-review')return reject;return {reply:'Hello again.',evidenceIds:[]};
  }});
  assert.equal(calls,4);const status=getPartyState(f.db,f.player.partyId,f.key);
  assert.equal(status.repaired,true);assert.equal(status.failureKind,'claim-review-not-accepted');
  assert.equal(getPartyState(f.db,f.player.partyId,f.diagnostics).audits.length,2);
  assert.deepEqual(getPartyState(f.db,f.player.partyId,'world:eldervale-roads'),f.state);
 }finally{f.db.close();}
});
test('a personal plan cannot start a repair without enough calls for its independent review',async()=>{
 const f=fixture();let calls=0;
 try{
  await resolveAction(f.db,getPlayer(f.db,f.player.id),'speak','nima have you visited with family?',{npcDialogueMode:'legacy',npcGenerate:async input=>{
   calls++;
   if(input.kind==='npc-conversation-input')return {tool:'read_knowledge',scope:'personal_experience',focus:'Has Nima visited with family?',reply:''};
   if(input.kind==='npc-answer-plan')return {question:'Has Nima visited with family?',knowledge:'unknown',supportIds:[],unknown:'No visit is established.'};
   if(input.kind==='npc-natural-performance')return {reply:'I have never visited.',evidenceIds:[]};
   assert.equal(input.kind,'npc-claim-review');return {...reject,personalAnswer:'unsupported'};
  }});
  assert.equal(calls,4);const status=getPartyState(f.db,f.player.partyId,f.key);
  assert.equal(status.repaired,false);assert.equal(status.failureKind,'repair-budget');
 }finally{f.db.close();}
});
function component(path,name){
 const exports={},require=createRequire(import.meta.url);
 runInNewContext(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require});
 return exports[name];
}
test('actual UI renders named progress stages, time budget and distinct failure reasons',()=>{
 const Progress=component('../src/ConversationProgress.tsx','ConversationProgress');
 assert.equal(renderToStaticMarkup(createElement(Progress,{active:false,progress:null})), '');
 const running=renderToStaticMarkup(createElement(Progress,{active:true,progress:{stage:'checking',startedAt:Date.now(),budgetMs:90000,calls:2}}));
 assert.match(running,/Checking the reply/);assert.match(running,/90s total/);assert.match(running,/role="status"/);
 const Status=component('../src/NpcDialogueStatus.tsx','NpcDialogueStatus');
 const status=renderToStaticMarkup(createElement(Status,{dialogue:{unavailable:true,source:'authored-fallback',failureKind:'conversation-time-limit',repaired:true,elapsedMs:90000,calls:3}}));
 assert.match(status,/90-second conversation limit/);assert.match(status,/One revision was attempted/);assert.match(status,/90s · 3 AI calls/);assert.doesNotMatch(status,/before publication/);
});
