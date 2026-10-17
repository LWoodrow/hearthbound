import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase,createPlayer,getPlayer,getParty,selectAdventure,setPartyState,getPartyState} from '../server/database.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import {resolveAction} from '../server/dm.mjs';
import {projectNpc,projectScene} from '../server/scene-projection.mjs';
import {conversationCatalogue} from '../server/npc-conversation-planner.mjs';
import {onePassContext,onePassMessages,onePassNpcDialogue} from '../server/npc-one-pass.mjs';
import {validateNpcSocial} from '../server/npc-social-schema.mjs';
import {practicalKnowledgeCoverage} from '../server/npc-knowledge-coverage.mjs';
import roads from '../server/adventures/eldervale-roads.mjs';

test('practical domains are explicit authored data, not inferred from names, roles or request wording',()=>{
 const npc=structuredClone(roads.story.npcs['city-delvers-memorial-resident']);
 const world=createCanonicalState(roads,{currentLocation:'city-delvers-memorial'}),projection={...projectNpc(npc,world),scene:projectScene(roads,world)};
 const coverage=onePassContext({npc,personality:{},projection,catalogue:conversationCatalogue(npc,projection,world),history:[]}).practicalKnowledge;
 assert.ok(coverage.known.some(record=>record.domain==='place'));assert.ok(coverage.known.some(record=>record.domain==='service'));
 for(const domain of ['opening-hours','menu','price','availability'])assert.ok(coverage.notRecorded.includes(domain));
 assert.doesNotMatch(JSON.stringify(coverage.known),/six o.clock|chicken stew/);
});

test('real recorded practical facts remain available while gated facts and invalid domains are rejected',()=>{
 // Use any actual authored resident: projection must not depend on Nima.
 const resident=structuredClone(Object.values(roads.story.npcs).find(row=>row.name==='Selka Emberglass'));
 resident.conversation.knowledge.push({id:'review-menu',domain:'menu',tier:'advice',subjects:['food'],text:'The recorded menu includes vegetable pie.'},{id:'review-hours',domain:'opening-hours',tier:'detail',subjects:['hours'],text:'Hidden opening hours.',requires:[{path:'flags.review-secret',truthy:true}]});
 const world=createCanonicalState(roads,{currentLocation:'city-delvers-last'}),projection={...projectNpc(resident,world),scene:projectScene(roads,world)};
 const catalogue=conversationCatalogue(resident,projection,world),coverage=practicalKnowledgeCoverage(catalogue.entries);
 assert.ok(coverage.known.some(record=>record.sourceId==='review-menu'));assert.ok(coverage.notRecorded.includes('opening-hours'));
 assert.doesNotMatch(JSON.stringify(coverage),/Hidden opening hours/);
 resident.conversation.knowledge.push({id:'bad-domain',domain:'give-equipment',tier:'advice',subjects:['bad'],text:'Invalid field.'});
 assert.ok(validateNpcSocial(resident,'review',roads).some(error=>error.includes('knowledge.domain')));
});

test('reported and held-out practical conversations use one call and keep old guesses outside established sources',async()=>{
 for(const [location,name,questions] of [
  ['city-delvers-memorial','Nima Dawnstone',['What time do you close today?','Where does good chicken?','That sounds ideal, thank you.']],
  ['city-delvers-last','Selka Emberglass',['What is on your menu today?','How much for fish and a room?','Thanks, I will rely on that.']],
  ['city-delvers-maps','Lethriel Mossink',['When does your shop open?','Do you have maps in stock today?','Thank you, that settles it.']],
 ]){
  const db=createDatabase(':memory:');try{
   const player=createPlayer(db,{partyId:'party-first-company',name:'Review',species:'Human',className:'Fighter'});
   selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');const world=createCanonicalState(roads,{currentLocation:location});setPartyState(db,player.partyId,'world:eldervale-roads',world);
   const npcId=Object.entries(roads.story.npcs).find(([,npc])=>npc.name===name)[0],key=`npcNaturalHistory:eldervale-roads:${npcId}:${player.id}`;
   const old={speech:'What is available?',reply:'The chicken costs five gold, served until six, and a room is free tonight.',evidenceIds:[],authority:'dialogue-only'};
   setPartyState(db,player.partyId,key,[old]);
   for(const question of questions){let calls=0;
    await resolveAction(db,getPlayer(db,player.id),'speak',question,{npcDialogueMode:'one-pass',npcGenerate:async request=>{
     calls++;const packet=JSON.parse(request.messages.at(-1).content),source=packet.sources;
     assert.equal(packet.newestPlayerSpeech,question);assert.match(source.limits.confirmation,/do not verify/);
     assert.ok(source.established.practicalKnowledge.notRecorded.includes('opening-hours'));
     assert.doesNotMatch(JSON.stringify(source.established),/five gold|room is free tonight/);
     const earlier=request.messages.filter(message=>message.role==='assistant').map(message=>JSON.parse(message.content));
     assert.ok(earlier.every(entry=>entry.authority==='unverified-dialogue-only'));
     return {kind:'speech',reply:'I cannot confirm those details. Ask the people there before making plans.',ids:[],approach:''};
    }});assert.equal(calls,1);
   }
   const history=getPartyState(db,player.partyId,key);assert.deepEqual(history[0],old);assert.equal(history.at(-1).authority,'dialogue-only');assert.equal(history.at(-1).verified,undefined);
   assert.deepEqual(getPartyState(db,player.partyId,'world:eldervale-roads'),world);
  }finally{db.close();}
 }
});

test('knowledge coverage and labelled history are prompt boundaries, not a semantic certification of model prose',()=>{
 const messages=onePassMessages({character:{name:'Resident'},place:{name:'Square'},facts:[],verifiedMemories:[],recent:[{playerSaid:'Thanks',npcSaid:'An unsupported earlier guess.'}],practicalKnowledge:practicalKnowledgeCoverage([]),reads:[],socialGoals:[]},'Is that certain?');
 assert.equal(JSON.parse(messages[2].content).authority,'unverified-dialogue-only');
 assert.match(messages[0].content,/does not make them true/);
 // No semantic parser/claim judge is introduced. Live model acceptance is
 // still required; a prompt cannot guarantee it will not invent a new claim.
});

test('a deliberate guarded practical read updates coverage only after the eligible lookup',async()=>{
 const npc=structuredClone(Object.values(roads.story.npcs).find(row=>row.name==='Selka Emberglass'));
 npc.conversation.knowledge.push({id:'review-guarded-menu',domain:'menu',tier:'detail',subjects:['recorded menu'],text:'The recorded menu includes vegetable pie.'});
 const world=createCanonicalState(roads,{currentLocation:'city-delvers-last'}),projection={...projectNpc(npc,world),scene:projectScene(roads,world)},catalogue=conversationCatalogue(npc,projection,world);
 let calls=0;const result=await onePassNpcDialogue({npc,personality:{},projection,catalogue,history:[],speech:'Please read me the recorded menu.',generate:async request=>{
  calls++;const packet=JSON.parse(request.messages.at(-1).content),coverage=packet.sources.established.practicalKnowledge;
  if(calls===1){
   assert.ok(coverage.notRecorded.includes('menu'));assert.doesNotMatch(JSON.stringify(packet),/vegetable pie/);
   const read=packet.reads.find(entry=>entry.subjects.includes('recorded menu'));
   return {kind:'read',reply:'',ids:[read.id],approach:''};
  }
  assert.ok(coverage.known.some(entry=>entry.domain==='menu'&&entry.sourceId==='review-guarded-menu'));
  return {kind:'speech',reply:'The recorded menu includes vegetable pie.',ids:[],approach:''};
 }});
 assert.equal(calls,2);assert.equal(result.lookupCount,1);assert.ok(result.disclosureIds.includes('review-guarded-menu'));
});
