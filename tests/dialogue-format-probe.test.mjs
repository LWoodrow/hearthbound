import test from 'node:test';
import assert from 'node:assert/strict';
import {generateStructured,generateText} from '../server/ai-transport.mjs';
import {anchoredEvaluationRequest,buildProbeRequest,probeCases,probeContext,probeVariants,runDialogueProbe} from '../scripts/probe-dialogue-format.mjs';
import {evaluateDialogue,scenarios} from '../scripts/evaluate-one-pass-dialogue.mjs';
import {onePassMessages,onePassSchema} from '../server/npc-one-pass.mjs';

const profile={id:'test',version:1,provider:'llamacpp',baseUrl:'http://example.test',model:'test',contextTokens:8192,think:false};
const output={kind:'speech',reply:'Maren mends clothes.',ids:[],approach:''};

test('format ablation preserves authored sources, newest speech and old dialogue across variants',()=>{
 const context=probeContext(probeCases.memory),requests=probeVariants.map(variant=>buildProbeRequest(context,probeCases.memory.speech,variant));
 assert.equal(new Set(requests.map(request=>request.sourceDigest)).size,1);
 assert.equal(new Set(requests.map(request=>request.historyDigest)).size,1);
 for(const request of requests){
  const last=JSON.parse(request.messages.at(-1).content);assert.equal(last.newestPlayerSpeech,probeCases.memory.speech);
  assert.doesNotMatch(JSON.stringify(last.sources.established),/Copper Swan|older brother/);
  assert.match(JSON.stringify(request.messages),/Copper Swan/);
 }
 assert.ok(requests[1].messages.some(message=>message.role==='assistant'));
 assert.equal(requests[4].messages.length,2,'scene history is labelled data, not extra chat roles');
 assert.deepEqual(requests[4].messages.map(message=>message.role),['system','user']);
 assert.throws(()=>buildProbeRequest(context,'hello','unknown'),/Unknown/);
});

test('read-only probe uses the selected encodings without repair or a semantic judge',async()=>{
 const calls=[],emitted=[];
 const result=await runDialogueProbe({profile,cases:['family'],variants:['chat-schema','chat-json','chat-text'],emit:value=>emitted.push(value),
  structured:async(_profile,_messages,_schema,generation)=>{calls.push('schema');assert.equal(generation.numPredict,240);assert.ok(generation.signal);return output;},
  text:async(_profile,messages)=>{calls.push('text');return messages[0].content.includes('Return JSON')?JSON.stringify(output):output.reply;},
 });
 assert.deepEqual(calls,['schema','text','text']);assert.equal(result.summary.requests,3);assert.equal(result.summary.formatFailures,0);
 assert.match(result.summary.semanticQuality,/not published game replies/);assert.equal(emitted.length,4);
 assert.ok(result.results.every(row=>row.sourceDigest===result.results[0].sourceDigest));
});

test('probe rotation is bounded and malformed JSON or transport errors do not trigger hidden retries',async()=>{
 let calls=0;
 const result=await runDialogueProbe({profile,cases:['family'],variants:['chat-json'],emit:()=>{},repeat:2,text:async()=>{calls++;if(calls===1)return 'not json';throw Error('private-provider-token');}});
 assert.equal(calls,2);assert.equal(result.summary.formatFailures,2);assert.doesNotMatch(JSON.stringify(result),/private-provider-token|not json/);
 await assert.rejects(runDialogueProbe({profile,cases:['unknown'],emit:()=>{}}),/Invalid/);
 await assert.rejects(runDialogueProbe({profile,repeat:4,emit:()=>{}}),/Invalid/);
 let clock=0;
 const stopped=await runDialogueProbe({profile,cases:['family'],variants:['chat-text','scene-text'],emit:()=>{},now:()=>clock,maxDurationMs:10,text:async()=>{clock=11;return 'Hello.';}});
 assert.equal(stopped.summary.requests,1);assert.equal(stopped.summary.exhausted,true);
});

test('diagnostic text transport preserves messages/options but never requests a JSON grammar',async()=>{
 for(const provider of ['llamacpp','ollama']){
  const messages=[{role:'user',content:'Hello.'}],controller=new AbortController();
  const reply=await generateText({...profile,provider},messages,{numPredict:80,temperature:.55,signal:controller.signal},async(url,options)=>{
   const body=JSON.parse(options.body);assert.deepEqual(body.messages,messages);assert.equal(body.response_format,undefined);assert.equal(body.format,undefined);assert.ok(options.signal);
   assert.equal(provider==='ollama'?body.options.num_predict:body.max_tokens,80);
   assert.equal(provider==='ollama'?body.options.temperature:body.temperature,.55);
   return {ok:true,json:async()=>provider==='ollama'?{message:{content:'Hello, traveller.'}}:{choices:[{message:{content:'Hello, traveller.'}}]}};
  });assert.equal(reply,'Hello, traveller.');
 }
});

test('structured failures remain failures, never an automatic plain-text fallback',async()=>{
 let calls=0;
 await assert.rejects(generateStructured(profile,[],{type:'object'},{},async()=>{calls++;return {ok:true,json:async()=>({choices:[{message:{content:'not json'}}]})};}));
 assert.equal(calls,1);
 await assert.rejects(generateText(profile,[],{},async()=>({ok:true,json:async()=>({choices:[]})})),/did not return an answer/);
});

test('anchored full-dispatch diagnostic retains session settings and refuses guarded capabilities',()=>{
 const context=probeContext(probeCases.family),generation={numPredict:240,timeoutMs:45000},request={kind:'npc-dialogue',messages:onePassMessages(context,probeCases.family.speech),schema:onePassSchema(context),generation};
 const adapted=anchoredEvaluationRequest(request);assert.equal(adapted.generation,generation);assert.equal(adapted.kind,request.kind);
 assert.deepEqual(adapted.schema.properties.speaker.enum,['Nima Dawnstone']);assert.deepEqual(adapted.schema.properties.listener.enum,['Nigel']);
 assert.deepEqual(adapted.decode({speaker:'Nima Dawnstone',listener:'Nigel',...output}),output);
 assert.throws(()=>adapted.decode({speaker:'Maren',listener:'Nigel',...output}),/Invalid diagnostic speaker/);
 const forbidden=structuredClone(request),data=JSON.parse(forbidden.messages.at(-1).content);data.reads=[{id:'k0'}];forbidden.messages.at(-1).content=JSON.stringify(data);
 assert.throws(()=>anchoredEvaluationRequest(forbidden),/ordinary-dialogue only/);
});

test('anchored experiment runs actual memory-only dispatch in one generation and measures the adapted packet',async()=>{
 const result=await evaluateDialogue({profile,scenario:scenarios.nima,limit:1,transformRequest:anchoredEvaluationRequest,emit:()=>{},generate:async(_profile,messages,schema)=>{
  assert.deepEqual(schema.properties.speaker.enum,['Nima Dawnstone']);assert.match(messages[0].content,/speaker=the NPC name/);
  return {speaker:'Nima Dawnstone',listener:'Nigel',...output};
 }});
 assert.equal(result.summary.totalCalls,1);assert.equal(result.summary.unavailableTurns,0);assert.equal(result.summary.canonicalChanges,0);
 assert.equal(result.turns[0].speaker,'Nima Dawnstone');assert.ok(result.turns[0].prompts[0].estimatedInputTokens>0);
});

test('wrong diagnostic speaker is withheld rather than silently relabelled or sent to another model',async()=>{
 let calls=0;
 const result=await evaluateDialogue({profile,scenario:scenarios.nima,limit:1,transformRequest:anchoredEvaluationRequest,emit:()=>{},generate:async()=>{
  calls++;return {speaker:'Maren',listener:'Nigel',...output};
 }});
 assert.equal(calls,1);assert.equal(result.summary.unavailableTurns,1);assert.equal(result.turns[0].speaker,'Dungeon Master');assert.equal(result.summary.canonicalChanges,0);
});
