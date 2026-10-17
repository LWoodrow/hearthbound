import test from 'node:test';
import assert from 'node:assert/strict';
import {simpleNpcRequest,simpleNpcChat} from '../scripts/lib/simple-npc-chat.mjs';
import {evaluateDialogue,scenarios} from '../scripts/evaluate-one-pass-dialogue.mjs';
const request=()=>({kind:'npc-dialogue',messages:[
 {role:'system',content:'Old long production contract'},
 {role:'user',content:'Tell a tale.'},
 {role:'assistant',content:JSON.stringify({previouslySaid:'Which kind?',thread:{request:'private task notes'},utteranceKind:'speech'})},
 {role:'user',content:JSON.stringify({sources:{established:{character:{name:'Nima',role:'Memorial keeper',life:{family:{sister:'Maren'},pleasures:['mending'],firsthandExperiences:['excluded duplicate anecdote']}},place:{name:'Wall'},facts:['A bakery is nearby.']}},player:{name:'Nigel'},conversationJournal:{priorThread:'stale machine task'},reads:[{id:'hidden-capability'}],newestPlayerSpeech:'A romance, please.'})},
]});
test('simple chat uses one compact brief, native speech and newest turn, without task machinery',()=>{
 const source=request(),original=JSON.stringify(source),result=simpleNpcRequest(source);
 assert.equal(result.encoding,'text');assert.equal(result.schema,undefined);
 assert.equal(result.messages.length,4);assert.equal(result.messages[1].content,'Tell a tale.');assert.equal(result.messages[2].content,'Which kind?');assert.equal(result.messages.at(-1).content,'A romance, please.');
 assert.doesNotMatch(JSON.stringify(result.messages),/private task notes|stale machine task|Old long production contract|hidden-capability|excluded duplicate anecdote/);
 assert.match(result.messages[0].content,/Maren|bakery/);assert.equal(JSON.stringify(source),original);
 assert.equal(result.generation.timeoutMs,15000);
});
test('one completion supplies all spoken words, without notes, repair, rewriting or a judge',async()=>{
 let calls=0;const words='Here is an imagined tale: two strangers met at a winter market and found their way home together.';
 const output=await simpleNpcChat(request(),async()=>{calls++;return words;});
 assert.equal(calls,1);assert.equal(output.reply,words);assert.equal(output.thread,undefined);assert.deepEqual(output.ids,[]);assert.equal(output.approach,'');
});
test('unsafe or oversize output is rejected once and remains available in the diagnostic audit',async()=>{
 for(const output of ['You now have a key.','x'.repeat(1001),null]){
  let calls=0;await assert.rejects(()=>simpleNpcChat(request(),async()=>{calls++;return output;}),{code:'invalid-output'});assert.equal(calls,1);
  const audit=simpleNpcRequest(request()).audit(output);assert.equal(audit.displayable,false);assert.equal(audit.rawReply,output);
 }
});
test('repair requests and malformed history never invoke the AI',async()=>{
 await assert.rejects(()=>simpleNpcChat({...request(),kind:'npc-dialogue-repair'},async()=>assert.fail('No repair call')),{code:'invalid-output'});
 const source=request();source.messages[2].content='{}';assert.throws(()=>simpleNpcRequest(source),{code:'invalid-output'});
});
test('real memory-only dispatcher selects plain transport once without structured inference or game effects',async()=>{
 let calls=0;const result=await evaluateDialogue({profile:{id:'test',model:'test',contextTokens:8192},scenario:scenarios['nima-simple'],limit:1,requestPipeline:simpleNpcChat,emit:()=>{},generate:async()=>assert.fail('No structured generation'),generatePlain:async()=>{calls++;return 'Hello, Nigel. A little company is always welcome.';}});
 assert.equal(calls,1);assert.equal(result.summary.totalCalls,1);assert.equal(result.summary.canonicalChanges,0);
 assert.equal(result.turns[0].conversationThread,null);assert.equal(result.turns[0].prompts[0].encoding,'text');assert.equal(result.turns[0].status.unavailable,false);
});
