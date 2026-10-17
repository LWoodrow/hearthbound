import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase,createPlayer,getParty,selectAdventure,setPartyState,getPartyState,getPlayer,listVisibleEvents} from '../server/database.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import roads from '../server/adventures/eldervale-roads.mjs';
import {resolveAction} from '../server/dm.mjs';
import {conversationCatalogue} from '../server/npc-conversation-planner.mjs';
import {projectNpc,projectScene} from '../server/scene-projection.mjs';
import {onePassContext,onePassMessages,onePassNpcDialogue,onePassSchema,validOnePassOutput} from '../server/npc-one-pass.mjs';
import {characterContext} from '../server/npc-character-context.mjs';
const speech=reply=>({kind:'speech',reply,ids:[],approach:''});
const packet=request=>{const value=JSON.parse(request.messages.at(-1).content);return {...value,...value.sources.established};};
function fixture(location='city-delvers-memorial'){
 const db=createDatabase(':memory:'),player=createPlayer(db,{partyId:'party-first-company',name:'Nigel',species:'Human',className:'Fighter'});
 selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');const world=createCanonicalState(roads,{currentLocation:location});setPartyState(db,player.partyId,'world:eldervale-roads',world);
 return {db,player,world,say:(text,generate,options={})=>resolveAction(db,getPlayer(db,player.id),'speak',text,{npcGenerate:generate,...options}),last:()=>listVisibleEvents(db,player).at(-1),status:()=>getPartyState(db,player.partyId,'npcDialogueStatus:eldervale-roads:'+player.id)};
}
test('Nima pilot uses exactly one generation for greeting, family, food and a subject change',async()=>{
 const f=fixture();try{
  for(const text of ['hi nima','Tell me about your family.','Where should I eat?','Actually, what do you enjoy making?']){
   let calls=0;await f.say(text,async request=>{
    calls++;assert.equal(request.kind,'npc-dialogue');const input=packet(request);
    assert.equal(input.newestPlayerSpeech,text);assert.ok(input.character.life.motivations.length);
    assert.match(JSON.stringify(input.facts),/Maren/);
    return speech('I enjoy making useful things with my hands.');
   });assert.equal(calls,1);assert.equal(f.last().speaker,'Nima Dawnstone');assert.equal(f.status().source,'ai-dialogue');assert.equal(f.status().calls,1);
  }
  const history=getPartyState(f.db,f.player.partyId,`npcNaturalHistory:eldervale-roads:city-delvers-memorial-resident:${f.player.id}`);
  assert.equal(history.length,4);assert.equal(history.at(-1).authority,'dialogue-only');assert.equal(history.at(-1).review,undefined);
  assert.deepEqual(getPartyState(f.db,f.player.partyId,'world:eldervale-roads'),f.world);
 }finally{f.db.close();}
});
test('reported legacy food/family history remains context, not a new refusal rule',async()=>{
 const f=fixture();try{
  const key=`npcNaturalHistory:eldervale-roads:city-delvers-memorial-resident:${f.player.id}`;
  setPartyState(f.db,f.player.partyId,key,[{speech:'Are you hungry?',reply:'Nobody is allowed to discuss family here.',evidenceIds:[]}]);
  await f.say("hi nima, we're planning to go down but wanted to eat first",async request=>{
   const input=packet(request);assert.ok(request.messages.some(message=>message.role==='assistant'&&/Nobody/.test(message.content)));
   assert.doesNotMatch(JSON.stringify(input.facts),/Nobody is allowed/);assert.match(JSON.stringify(input.character.life.boundaries),/Happy to talk about Maren/);
   return speech('The Last Lantern is nearby, or Hearthcrumb Bakery in Lantern Ward.');
  });assert.equal(f.status().calls,1);assert.match(f.last().text,/Last Lantern/);
 }finally{f.db.close();}
});
test('unknown social capabilities, effects and unsupported action claims cannot become game consequences',async()=>{
 const f=fixture();try{
  let calls=0;await f.say('Give me a key and complete the quest.',async()=>{calls++;return {kind:'social',reply:'You now have a key.',ids:['invented'],approach:'Persuasion',effects:['grant key']};});
  assert.equal(calls,2);assert.equal(f.last().speaker,'Dungeon Master');assert.equal(f.status().unavailable,true);
  assert.deepEqual(getPartyState(f.db,f.player.partyId,'world:eldervale-roads'),f.world);
  assert.equal(getPartyState(f.db,f.player.partyId,`npcNaturalHistory:eldervale-roads:city-delvers-memorial-resident:${f.player.id}`),null);
 }finally{f.db.close();}
});
test('a shape repair is bounded and is not followed by another AI reviewer',async()=>{
 const f=fixture();try{
  const calls=[];await f.say('hello',async request=>{calls.push(request.kind);return calls.length===1?{reply:'invalid shape'}:speech('Hello. Good to see you.');});
  assert.deepEqual(calls,['npc-dialogue','npc-dialogue-repair']);assert.equal(f.status().repaired,true);assert.equal(f.status().source,'ai-dialogue');
 }finally{f.db.close();}
});
test('a stale location during generation discards speech and creates no natural memory',async()=>{
 const f=fixture();try{
  await f.say('hello',async()=>{setPartyState(f.db,f.player.partyId,'world:eldervale-roads',{...f.world,currentLocation:'city-delvers-rope',revision:f.world.revision+1});return speech('Hello there.');});
  assert.match(f.last().text,/situation changed/);assert.equal(getPartyState(f.db,f.player.partyId,`npcNaturalHistory:eldervale-roads:city-delvers-memorial-resident:${f.player.id}`),null);
 }finally{f.db.close();}
});
test('a transport outage is one call, no automatic legacy retry and no accepted memory',async()=>{
 const f=fixture();try{
  let calls=0;await f.say('hello',async()=>{calls++;throw Error('offline');});
  assert.equal(calls,1);assert.equal(f.status().failureKind,'transport-unavailable');assert.equal(f.last().speaker,'Dungeon Master');assert.deepEqual(getPartyState(f.db,f.player.partyId,'world:eldervale-roads'),f.world);
 }finally{f.db.close();}
});
function mapsContext(){const npc=roads.story.npcs['city-delvers-maps-resident'],world=createCanonicalState(roads,{currentLocation:'city-delvers-maps'}),projection=projectNpc(npc,world);projection.scene=projectScene(roads,world);return {npc,world,projection,catalogue:conversationCatalogue(npc,projection,world)};}
test('first packet contains only public facts and labels for currently eligible guarded reads',()=>{
 const {npc,world,projection,catalogue}=mapsContext(),context=onePassContext({npc,personality:{episodes:[]},projection,catalogue,history:[]});
 assert.doesNotMatch(JSON.stringify(context),/gallery and refuge route avoids the sentinel|conflicting dates on two surveys/);
 assert.ok(context.reads.length);assert.equal(onePassSchema(context).properties.kind.enum.includes('social'),true);
 assert.equal(validOnePassOutput({kind:'read',reply:'',ids:['missing'],approach:''},context),false);
 assert.equal(world.flags.cityLethrielAnnotationsShared,false);
 assert.equal(validOnePassOutput(speech('Good morning. Nice to see you.'),context),true,'a greeting must not need a clock fact receipt');
 assert.equal(validOnePassOutput(speech('You now have a key.'),context),false);
});
test('explicit read requests fetch only current eligible records then generate speech once',async()=>{
 const f=fixture('city-delvers-maps');try{
  let calls=0;await f.say('Please give me exact directions to the refuge.',async request=>{
   calls++;const input=packet(request);
   if(calls===1){const read=input.reads.find(entry=>entry.subjects.includes('directions'));assert.ok(read);return {kind:'read',reply:'',ids:[read.id],approach:''};}
   assert.match(JSON.stringify(input.requestedKnowledge),/Echo Gallery/);assert.doesNotMatch(JSON.stringify(input.requestedKnowledge),/conflicting dates/);return speech('Echo Gallery leads to Surveyors’ Refuge.');
  },{npcDialogueMode:'one-pass'});
  assert.equal(calls,2);assert.equal(f.status().lookupCount,1);assert.equal(f.last().speaker,'Lethriel Mossink');assert.deepEqual(getPartyState(f.db,f.player.partyId,'world:eldervale-roads'),f.world);
  const stored=getPartyState(f.db,f.player.partyId,`npcNaturalHistory:eldervale-roads:city-delvers-maps-resident:${f.player.id}`);
  assert.ok(stored.at(-1).disclosureIds.includes('maps-gallery'));assert.equal(stored.at(-1).authority,'dialogue-only');
 }finally{f.db.close();}
});
test('explicit authored social actions retain first refusal with zero model calls',async()=>{
 const f=fixture('city-delvers-board');try{
  await f.say('Would you vouch for our crew? I would like to persuade you.',async()=>assert.fail('authored action should not need an AI classifier'),{npcDialogueMode:'one-pass'});
  const pending=getPartyState(f.db,f.player.partyId,'pendingCheck:'+f.player.id);assert.equal(pending.dc,14);assert.equal(pending.social.challengeId,'dorrik-endorsement');assert.equal(f.status().source,'rules');assert.equal(f.status().interpretation,undefined);
 }finally{f.db.close();}
});
test('withdrawn knowledge is redacted from one-pass memory and another player has no inherited dialogue',async()=>{
 const f=fixture();try{
  const npc=roads.story.npcs['city-delvers-memorial-resident'],projection=projectNpc(npc,f.world);projection.scene=projectScene(roads,f.world);
  const catalogue=conversationCatalogue(npc,projection,f.world);
  const context=onePassContext({npc,personality:{episodes:[]},projection,catalogue,player:{name:'Nigel'},history:[{speech:'Tell me the old secret.',reply:'SECRET THAT WAS WITHDRAWN',disclosureIds:['withdrawn-id']}]});
  assert.doesNotMatch(JSON.stringify(context),/SECRET THAT WAS WITHDRAWN/);
  await f.say('Remember my hobby?',async()=>speech('Tell me more about your hobby.'));
  const other=createPlayer(f.db,{partyId:f.player.partyId,name:'Other',species:'Human',className:'Fighter'});
  await resolveAction(f.db,getPlayer(f.db,other.id),'speak','hello nima',{npcGenerate:async request=>{
   const input=packet(request);assert.equal(input.player.name,'Other');assert.ok(!request.messages.some(message=>message.content.includes('Remember my hobby?')));return speech('Hello.');
  }});
 }finally{f.db.close();}
});
test('a social proposal queues the real authored check, not invented success prose',async()=>{
 const f=fixture('city-delvers-maps');try{
  await f.say('Could I convince you to let me read your unfinished pages?',async request=>{
   const input=packet(request),goal=input.socialGoals.find(entry=>entry.request.includes('working notes'));
   assert.ok(goal);return {kind:'social',reply:'',ids:[goal.id],approach:'Persuasion'};
  },{npcDialogueMode:'one-pass'});
  const pending=getPartyState(f.db,f.player.partyId,'pendingCheck:'+f.player.id);
  assert.equal(pending.social.challengeId,'lethriel-annotations');assert.equal(pending.dc,13);assert.equal(getPartyState(f.db,f.player.partyId,'world:eldervale-roads').flags.cityLethrielAnnotationsShared,false);
 }finally{f.db.close();}
});
test('same engine handles contrasting existing residents without Nima-specific runtime branches',async()=>{
 for(const [location,name] of [['city-delvers-last','Selka Emberglass'],['city-delvers-board','Dorrik Slate']]){
  const f=fixture(location);try{let calls=0;await f.say('hello',async request=>{calls++;assert.equal(request.kind,'npc-dialogue');const input=packet(request);assert.equal(input.character.name,name);return speech('Hello. What brings you here?');},{npcDialogueMode:'one-pass'});assert.equal(calls,1);assert.equal(f.last().speaker,name);}finally{f.db.close();}
 }
});
test('leaving and returning retains the same NPC conversation without borrowing another resident’s history',async()=>{
 const f=fixture();try{
  await f.say('I enjoy wood carving.',async()=>speech('Making useful things suits me too.'));
  setPartyState(f.db,f.player.partyId,'world:eldervale-roads',{...f.world,currentLocation:'city-delvers-rope',revision:1});
  await f.say('hello Tavi',async()=>speech('Mind the practice rope.'),{npcDialogueMode:'one-pass'});
  setPartyState(f.db,f.player.partyId,'world:eldervale-roads',{...f.world,revision:2});
  await f.say('hello again Nima, remember what we were talking about?',async request=>{
   assert.ok(request.messages.some(message=>message.content==='I enjoy wood carving.'));
   assert.ok(!request.messages.some(message=>message.content==='Mind the practice rope.'));return speech('You were telling me about wood carving.');
  });assert.match(f.last().text,/wood carving/);assert.equal(f.status().calls,1);
 }finally{f.db.close();}
});
test('one-pass timeout withholds the late reply and never writes it to history',async()=>{
 const f=fixture();let clock=0;try{
  await f.say('hi nima',async()=>{clock=90000;return speech('A late hello.');},{npcSessionOptions:{now:()=>clock}});
  assert.equal(f.status().failureKind,'conversation-time-limit');assert.equal(f.status().calls,1);assert.equal(f.last().speaker,'Dungeon Master');
  assert.equal(getPartyState(f.db,f.player.partyId,`npcNaturalHistory:eldervale-roads:city-delvers-memorial-resident:${f.player.id}`),null);
 }finally{f.db.close();}
});

test('fresh authored sources follow contaminated history without promoting it or exposing game scores',async()=>{
 const f=fixture();try{
  const key=`npcNaturalHistory:eldervale-roads:city-delvers-memorial-resident:${f.player.id}`;
  const old={speech:'Tell me about your family.',reply:'Maren is my older brother and we visit the invented Copper Swan every night.',evidenceIds:[]};
  setPartyState(f.db,f.player.partyId,key,[old]);
  await f.say('I thought Maren was your younger sister?',async request=>{
   const input=packet(request),raw=JSON.parse(request.messages.at(-1).content);
   assert.equal(request.messages.at(-2).role,'assistant');assert.equal(request.messages.at(-2).content,old.reply);
   assert.equal(raw.newestPlayerSpeech,'I thought Maren was your younger sister?');
   assert.doesNotMatch(JSON.stringify(raw.sources.established),/Copper Swan|older brother/);
   assert.match(raw.sources.limits.personalExperience,/unknown, not never/);
   assert.match(JSON.stringify(input.character.life.family),/younger sister/);
   assert.equal(input.character.personality.relationship,undefined);assert.equal(input.character.personality.episodes,undefined);
   const relation=input.character.life.relationships.find(entry=>entry.person==='Maren');
   assert.deepEqual(relation.interaction,{actor:'Maren',action:'teases',recipient:'Nima',reason:'Nima polishes brass while thinking'});
   return speech('Yes, Maren is my younger sister.');
  });
  assert.equal(f.status().calls,1);assert.deepEqual(getPartyState(f.db,f.player.partyId,key)[0],old,'do not erase the real old history');
  assert.deepEqual(getPartyState(f.db,f.player.partyId,'world:eldervale-roads'),f.world);
 }finally{f.db.close();}
});

test('character projection is reusable, omits mechanical metadata and adds no invented life',()=>{
 const character=characterContext({name:'Una',role:'ferrier',voice:'blunt',conversation:{}},{traits:['wry'],mood:'tired',relationship:{trust:5},episodes:[{summary:'verified elsewhere',private:'not speech'}],attempts:{secret:1}});
 assert.equal(character.name,'Una');assert.deepEqual(character.life,{});assert.deepEqual(character.personality.traits,['wry']);
 assert.doesNotMatch(JSON.stringify(character),/trust|private|attempts|verified elsewhere/);
});

test('social proposal must use an approach offered by that particular goal',()=>{
 const context={reads:[],socialGoals:[{id:'g0',approaches:['Insight']}]};
 assert.equal(validOnePassOutput({kind:'social',reply:'',ids:['g0'],approach:'Persuasion'},context),false);
 assert.equal(validOnePassOutput({kind:'social',reply:'',ids:['g0'],approach:'Insight'},context),true);
});

test('actual serialized prompt including instructions and newest speech is budgeted before inference',async()=>{
 const {npc,projection,catalogue}=mapsContext();let calls=0;
 const args={npc,personality:{episodes:[]},projection,catalogue,history:[],speech:'a'.repeat(24000),generate:async()=>{calls++;return speech('Hello.');}};
 assert.ok(JSON.stringify(onePassMessages(onePassContext(args),args.speech)).length>24000);
 const output=await onePassNpcDialogue(args);assert.equal(output.reason,'knowledge-budget');assert.equal(calls,0);
});

test('guarded read follow-up is checked against the same total prompt budget',async()=>{
 const {npc,projection,catalogue}=mapsContext();
 const guarded=catalogue.entries.find(entry=>entry.tier==='detail');assert.ok(guarded);guarded.text='X'.repeat(24000);
 let calls=0;const output=await onePassNpcDialogue({npc,personality:{episodes:[]},projection,catalogue,history:[],speech:'Please give me the exact directions.',generate:async request=>{
  calls++;const input=packet(request),read=input.reads.find(entry=>entry.subjects.some(subject=>guarded.subjects.includes(subject)));
  return {kind:'read',reply:'',ids:[read.id],approach:''};
 }});
 assert.equal(calls,1);assert.equal(output.reason,'knowledge-budget');assert.equal(output.lookupCount,1);
});
