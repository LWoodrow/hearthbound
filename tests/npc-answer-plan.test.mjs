import test from 'node:test';
import assert from 'node:assert/strict';
import {validAnswerPlan} from '../server/npc-answer-plan.mjs';
import {naturalNpcReply} from '../server/npc-natural-dialogue.mjs';
import {assessNpcInput} from '../server/npc-conversation-tools.mjs';
const evidence=[{id:'family',text:'A younger sister named Maren mends clothes.',tier:'everyday'}];
const unknown={question:'Has this resident visited the recommended eating places with relatives?',knowledge:'unknown',supportIds:[],unknown:'No firsthand dining or family outing is established.'};
const packet={focusVersion:2,answerScope:'personal_experience',npc:{name:'Resident'},newestSpeech:'Taken your family to any of those?',history:[],evidence};
test('AI-classified personal history cannot bypass knowledge through a social draft',async()=>{
 const result=await assessNpcInput({npc:{name:'Resident'},history:[],speech:'Did you visit?',generate:async()=>({tool:'respond_social',scope:'personal_experience',focus:'Did this resident visit?',reply:'Yes, many times.'})});
 assert.equal(result.tool,'read_knowledge');assert.equal(result.reply,'');assert.equal(result.scope,'personal_experience');
});
test('answerability separates an unknown experience from unrelated biographical evidence',()=>{
 assert.equal(validAnswerPlan(unknown,evidence),true);
 assert.equal(validAnswerPlan({...unknown,knowledge:'supported'},evidence),false);
 assert.equal(validAnswerPlan({...unknown,supportIds:['family']},evidence),false);
 assert.equal(validAnswerPlan({...unknown,knowledge:'partial',supportIds:['unknown-id']},evidence),false);
 assert.equal(validAnswerPlan({...unknown,effects:['visit']},evidence),false);
 assert.equal(validAnswerPlan({question:'Who is her sister?',knowledge:'supported',supportIds:['family'],unknown:''},evidence),true);
});
test('personal answer plan precedes prose and a mistaken approval of negative history is rejected',async()=>{
 const calls=[];let reviews=0;
 const result=await naturalNpcReply({packet,assessed:true,generate:async request=>{
  calls.push(request.kind);const data=JSON.parse(request.messages[1].content);
  if(request.kind==='npc-answer-plan')return unknown;
  assert.equal(data.answerPlan.knowledge,'unknown');
  if(request.kind==='npc-natural-performance'){
   assert.deepEqual(data.evidence,[]);assert.deepEqual(data.history,[]);
   return {reply:'I have never taken my sister there.',evidenceIds:[]};
  }
  if(request.kind==='npc-natural-repair')return {reply:'I cannot give you a firsthand family recommendation. What sort of food are you after?',evidenceIds:[]};
  return {decision:'accept',feedback:'',claims:[],lookupIds:[],personalAnswer:++reviews===1?'supported':'acknowledges_unknown'};
 }});
 assert.equal(result.source,'ai-reviewed');assert.equal(result.repaired,true);
 assert.doesNotMatch(result.reply,/never|not taken/);assert.equal(result.audits[0].rejectedPersonalAnswer,true);assert.equal(result.audits.at(-1).personalAnswer,'acknowledges_unknown');
 assert.deepEqual(calls,['npc-answer-plan','npc-natural-performance','npc-claim-review','npc-natural-repair','npc-claim-review']);
});
test('invalid answerability plan withholds speech without generating a replacement biography',async()=>{
 let calls=0;
 const result=await naturalNpcReply({packet,assessed:true,generate:async()=>{calls++;return {...unknown,supportIds:['invented']};}});
 assert.equal(calls,1);assert.equal(result.unavailable,true);assert.equal(result.reason,'answer-plan-invalid');
});
test('known personal biography remains available without turning every personal question into uncertainty',async()=>{
 const result=await naturalNpcReply({packet:{...packet,newestSpeech:'Tell me about your sister.'},assessed:true,generate:async request=>{
  if(request.kind==='npc-answer-plan')return {question:'Who is this resident’s sister?',knowledge:'supported',supportIds:['family'],unknown:''};
  if(request.kind==='npc-natural-performance')return {reply:'My younger sister Maren mends clothes.',evidenceIds:['family']};
  return {decision:'accept',feedback:'',claims:[{text:'Her younger sister Maren mends clothes.',evidenceIds:['family']}],lookupIds:[],personalAnswer:'supported'};
 }});
 assert.equal(result.source,'ai-reviewed');assert.match(result.reply,/Maren/);
});
