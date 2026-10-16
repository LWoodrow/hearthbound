import test from 'node:test';
import assert from 'node:assert/strict';
import {compactNpcRequest} from '../server/npc-wire-format.mjs';
import {naturalReplySchema} from '../server/npc-natural-dialogue.mjs';
import {claimReviewSchema} from '../server/npc-grounded-conversation.mjs';
const request=(kind,input,schema)=>({kind,schema,messages:[{role:'system',content:'Contract'},{role:'user',content:JSON.stringify(input)}],generation:{numPredict:160}});

test('short generation IDs round-trip to canonical IDs without changing the evidence',()=>{
 const source=request('npc-natural-performance',{focusVersion:2,newestSpeech:'A question',evidence:[{id:'very-long-canonical-knowledge-id',text:'Canonical fact.',tier:'everyday',subjects:['topic']}],history:[]},naturalReplySchema);
 const wire=compactNpcRequest(source),input=JSON.parse(wire.request.messages[1].content);
 assert.deepEqual(input.evidence,[{id:'e0',text:'Canonical fact.'}]);assert.deepEqual(wire.request.schema.properties.evidenceIds.items.enum,['e0']);
 assert.deepEqual(wire.decode({reply:'A reply',evidenceIds:['e0']}),{reply:'A reply',evidenceIds:['very-long-canonical-knowledge-id']});
 assert.equal(source.schema.properties.evidenceIds.items.enum,undefined);
 assert.equal(wire.decode({reply:'A reply',evidenceIds:['unknown']}).evidenceIds[0],'unknown','unknown IDs survive decoding so authority validation rejects them');
});

test('review receipts and lookup tool IDs have separate short-ID spaces and preserve invalid extras for rejection',()=>{
 const wire=compactNpcRequest(request('npc-claim-review',{evidence:[{id:'canonical-a',text:'Fact A'}],candidate:{reply:'Fact A',evidenceIds:['canonical-a']},availableKnowledge:[{id:'canonical-b',subjects:['topic B']}]},claimReviewSchema));
 const input=JSON.parse(wire.request.messages[1].content);assert.deepEqual(input.candidate.evidenceIds,['e0']);assert.equal(input.availableKnowledge[0].id,'k0');
 const output=wire.decode({decision:'lookup',feedback:'Need B',claims:[{text:'A',evidenceIds:['e0']}],lookupIds:['k0'],effects:['do not execute']});
 assert.deepEqual(output.claims[0].evidenceIds,['canonical-a']);assert.deepEqual(output.lookupIds,['canonical-b']);assert.deepEqual(output.effects,['do not execute']);
});

test('input assessment and legacy output contracts are not rewritten',()=>{
 const input=request('npc-conversation-input',{evidence:[]},{});assert.equal(compactNpcRequest(input).request,input);
 const legacy=request('npc-natural-performance',{evidence:[]},naturalReplySchema);assert.equal(compactNpcRequest(legacy).request,legacy);
});
