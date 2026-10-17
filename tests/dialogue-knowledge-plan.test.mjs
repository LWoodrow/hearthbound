import test from 'node:test';
import assert from 'node:assert/strict';
import {knowledgeCards,knowledgePlanRequest,excerptPlanRequest,nativeConversationRequest} from '../scripts/lib/dialogue-knowledge-plan.mjs';
import {probeContext,probeCases} from '../scripts/probe-dialogue-format.mjs';
import {onePassMessages,onePassSchema} from '../server/npc-one-pass.mjs';
import {evaluateDialogue,scenarios} from '../scripts/evaluate-one-pass-dialogue.mjs';

const profile={id:'test',version:1,model:'test',contextTokens:8192};
function request(){const context=probeContext(probeCases.memory);return {kind:'npc-dialogue',messages:onePassMessages(context,probeCases.memory.speech),schema:onePassSchema(context),generation:{numPredict:240,timeoutMs:45000,signal:new AbortController().signal}};}
const plain={kind:'speech',reply:'Maren mends clothes.',ids:[],approach:''};

test('knowledge cards distinguish authored experiences, opinion and verified events without learning old dialogue',()=>{
 const context=probeContext(probeCases.memory);context.verifiedMemories=['A validated return promise was recorded.'];
 const {cards,subjects}=knowledgeCards(context);
 assert.ok(cards.some(card=>card.kind==='recorded-experience'&&card.content.event.includes('buttons')));
 assert.ok(cards.some(card=>card.kind==='opinion'));assert.ok(cards.some(card=>card.kind==='verified-encounter'));
 assert.ok(subjects.includes('Maren'));assert.ok(subjects.includes('Nigel'));assert.equal(new Set(cards.map(card=>card.id)).size,cards.length);
 assert.doesNotMatch(JSON.stringify(cards),/Copper Swan|older brother|silverberry pie/);
 assert.ok(cards.every(card=>card.owner==='Nima Dawnstone'));
});

test('same projector works for an unrelated authored character and bounds source cardinality',()=>{
 const context={character:{name:'Una',role:'ferrier',life:{family:{child:{name:'Kit',occupation:'carpenter'}},firsthandExperiences:[{event:'Repaired a mooring'}]}},player:{name:'Guest'},facts:['The ferry landing is public.'],verifiedMemories:[]};
 const projected=knowledgeCards(context);assert.ok(projected.subjects.includes('Kit'));assert.ok(projected.cards.every(card=>card.owner==='Una'));
 assert.throws(()=>knowledgeCards({...context,facts:Array(61).fill('A public fact.')}),/source budget/);
});

test('same-call ID plan validates labels, scope and support shape but grants no game capability',()=>{
 const original=request(),adapted=knowledgePlanRequest(original),input=JSON.parse(adapted.messages.at(-1).content);
 const source=input.facts.find(card=>card.kind==='personal-family');
 const output={speaker:'Nima Dawnstone',listener:'Nigel',subject:'Maren',support:'known',facts:[source.id],reply:plain.reply};
 assert.deepEqual(adapted.decode(output),plain);assert.deepEqual(adapted.audit(output),{subject:'Maren',support:'known',facts:[source.id]});
 assert.equal(adapted.generation.signal,original.generation.signal);assert.equal(adapted.generation.timeoutMs,45000);assert.equal(adapted.generation.numPredict,360);
 for(const bad of [{...output,facts:[]},{...output,facts:['secret']},{...output,facts:[source.id,source.id]},{...output,support:'unknown'},{...output,speaker:'Maren'},{...output,subject:'Invented person'},{...output,effects:['grant key']}])assert.throws(()=>adapted.decode(bad),error=>error.code==='invalid-output');
 const unknown={...output,support:'unknown',facts:[],reply:'I cannot give you a firsthand verdict.'};assert.equal(adapted.decode(unknown).reply,unknown.reply);
 const forbidden=structuredClone({...original,generation:{}}),data=JSON.parse(forbidden.messages.at(-1).content);data.socialGoals=[{id:'g0'}];forbidden.messages.at(-1).content=JSON.stringify(data);
 assert.throws(()=>knowledgePlanRequest(forbidden),/ordinary-dialogue only/);
});

test('excerpt plan requires an exact current source and keeps the focus/selection out of spoken output',()=>{
 const adapted=excerptPlanRequest(request()),data=JSON.parse(adapted.messages.at(-1).content),excerpt=data.excerpts.find(value=>value.includes('personal-family'));
 const output={speaker:'Nima Dawnstone',listener:'Nigel',focus:'What does Maren do?',support:'recorded',excerpt,reply:plain.reply};
 assert.deepEqual(adapted.decode(output),plain);assert.equal(adapted.audit(output).facts.length,1);assert.equal(adapted.generation.numPredict,480);
 for(const bad of [{...output,excerpt:'Maren rules the city.'},{...output,excerpt:''},{...output,support:'unrecorded'},{...output,focus:''},{...output,sourceIsTrue:true}])assert.throws(()=>adapted.decode(bad),error=>error.code==='invalid-output');
 assert.equal(adapted.decode({...output,support:'unrecorded',excerpt:'',reply:'I cannot vouch for it firsthand.'}).reply,'I cannot vouch for it firsthand.');
});

test('native conversation control retains the exact latest speech and old chat without promoting old claims',()=>{
 const original=request(),adapted=nativeConversationRequest(original);
 assert.equal(adapted.messages.at(-1).content,probeCases.memory.speech);assert.equal(adapted.messages.at(-1).role,'user');
 assert.match(adapted.messages[0].content,/You are Nima Dawnstone/);assert.doesNotMatch(adapted.messages[0].content,/Copper Swan|silverberry pie/);
 assert.ok(adapted.messages.some(message=>message.role==='assistant'&&message.content.includes('Copper Swan')));
 assert.equal(adapted.schema,original.schema);assert.equal(adapted.generation,original.generation);assert.equal(adapted.decode,undefined);
});

test('all three experimental layouts use actual memory-only dispatch in one call without state effects',async()=>{
 for(const transformRequest of [knowledgePlanRequest,excerptPlanRequest,nativeConversationRequest]){
  const result=await evaluateDialogue({profile,scenario:scenarios.nima,limit:1,transformRequest,emit:()=>{},generate:async(_profile,messages,schema)=>{
   if(schema.oneOf){
    if(schema.oneOf[0].properties.subject)return {speaker:'Nima Dawnstone',listener:'Nigel',subject:'Nima Dawnstone',support:'social',facts:[],reply:'Hello.'};
    return {speaker:'Nima Dawnstone',listener:'Nigel',focus:'A greeting',support:'social',excerpt:'',reply:'Hello.'};
   }
   assert.equal(messages.at(-1).content,'hi nima');return {...plain,reply:'Hello.'};
  }});
  assert.equal(result.summary.totalCalls,1);assert.equal(result.summary.canonicalChanges,0);assert.equal(result.summary.unavailableTurns,0);
  assert.equal(result.turns[0].status.source,'ai-dialogue');assert.equal(result.turns[0].reply,'Hello.');
  const prompt=result.turns[0].prompts[0];assert.ok(prompt.responseTokens>0);assert.match(result.summary.semanticQuality,/Requires human reading/);
  if(transformRequest!==nativeConversationRequest)assert.equal(prompt.selection.support,'social');
 }
});

test('bad knowledge-plan output is withheld once, identified as protocol failure, and never retried with another judge',async()=>{
 let calls=0;
 const result=await evaluateDialogue({profile,scenario:scenarios.nima,limit:1,transformRequest:knowledgePlanRequest,emit:()=>{},generate:async()=>{
  calls++;return {speaker:'Nima Dawnstone',listener:'Nigel',subject:'Nima Dawnstone',support:'known',facts:['invented-id'],reply:'Hello.'};
 }});
 assert.equal(calls,1);assert.equal(result.summary.unavailableTurns,1);assert.equal(result.summary.canonicalChanges,0);
 assert.equal(result.turns[0].speaker,'Dungeon Master');assert.equal(result.turns[0].status.failureKind,'invalid-output');
});

test('a structurally valid source selection is not treated as factual proof of its prose',()=>{
 const adapted=knowledgePlanRequest(request()),output={speaker:'Nima Dawnstone',listener:'Nigel',subject:'Maren',support:'unknown',facts:[],reply:'I have never visited those places.'};
 // This deliberately bad semantic answer can pass structural checks. The
 // experiment reports the selection; it does not pretend to verify the claim.
 assert.equal(adapted.decode(output).reply,output.reply);assert.deepEqual(adapted.audit(output).facts,[]);
 assert.equal(adapted.audit(output).grounded,undefined);
});
