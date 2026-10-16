import test from 'node:test';
import assert from 'node:assert/strict';
import roads from '../server/adventures/eldervale-roads.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import {projectNpc} from '../server/scene-projection.mjs';
import {conversationEvidence,npcPersonality,npcRelationship,planSocialAttempt,resolveSocialAttempt} from '../server/npc-social-engine.mjs';
import {naturalNpcReply,validNaturalReply} from '../server/npc-natural-dialogue.mjs';
import {validateAdventure} from '../server/adventure-schema.mjs';
import {createDatabase,createPlayer,getParty,selectAdventure,setPartyState,getPartyState,getPlayer,listVisibleEvents,resetPartyStory} from '../server/database.mjs';
import {resolveAction,resolvePendingCheck} from '../server/dm.mjs';
const npcId='city-delvers-maps-resident',npc=roads.story.npcs[npcId];
const at=(flags={})=>createCanonicalState(roads,{currentLocation:'city-delvers-maps',flags});
const request=(world=at(),action='Could you share your private annotations please?')=>planSocialAttempt({npc,npcId,playerId:'p',world,action});
const packet={npc:{name:'Lethriel',role:'Cartographer'},personality:{traits:['curious','guarded']},newestSpeech:'What map is good for exploring below?',history:[],evidence:[{id:'folio',text:'The public folio covers the upper streets and Rope Landing.',tier:'advice'}]};
const verdict={grounded:true,relevant:true,inCharacter:true,noConsequences:true};

test('personality contrasts and relationship projection preserve authored identity and bounded values',()=>{
 const relationship=npcRelationship({social:{[npcId]:{p:{trust:100,respect:-30,fear:-1,mood:'irritated',episodes:[{summary:'Returned evidence.'}]}}}},npcId,'p');
 assert.equal(relationship.trust,5);assert.equal(relationship.respect,-5);assert.equal(relationship.fear,0);
 const projection=npcPersonality(npc,relationship);assert.equal(projection.mood,'irritated');assert.ok(projection.traits.includes('curious'));
 assert.equal(npcRelationship(at(),npcId,'other').trust,0);
 assert.equal(new Set(Object.values(roads.story.npcs).filter(n=>n.personality).map(n=>n.personality.traits.join(','))).size,9);
});
test('practical map recommendation is relevant and cannot retrieve unsolicited route/puzzle solutions',()=>{
 const world=at(),projection=projectNpc(npc,world);
 const evidence=conversationEvidence(npc,projection,world,'what maps would be good for exploring down below?');
 assert.ok(evidence.some(entry=>entry.id==='maps-upper-folio'));assert.ok(evidence.every(entry=>['everyday','advice'].includes(entry.tier)));
 assert.doesNotMatch(evidence.map(entry=>entry.text).join(' '),/sentinel|gate wheel|playable/);
 assert.ok(conversationEvidence(npc,projection,world,'how can we avoid the sentinel on Ward Street?').some(entry=>entry.id==='maps-ward-bypass'));
 assert.ok(!conversationEvidence(npc,projection,world,'tell me the private annotations').some(entry=>entry.id==='maps-private-annotation'));
});
test('reviewed natural speech can differ from fact strings and transport receives personality/history without engine secrets',async()=>{
 const calls=[];
 const result=await naturalNpcReply({packet,fallback:'Fallback.',generate:async request=>{calls.push(request);return {output:calls.length===1?{reply:'Start with the public folio. It covers the upper streets and the way back to Rope Landing; what were you hoping to explore?',evidenceIds:['folio']}:verdict};}});
 assert.equal(result.source,'ai-reviewed');assert.equal(calls.length,2);assert.notEqual(result.reply,packet.evidence[0].text);
 assert.ok(calls[0].messages[1].content.includes('guarded'));
});
test('unsupported claims, fake citations, engine terms, malformed output and failed review fall back safely',async()=>{
 for(const output of [
  {reply:'I will give you a secret key.',evidenceIds:['folio']},
  {reply:'A new route opens.',evidenceIds:['secret']},
  {reply:'There are no playable rooms.',evidenceIds:['folio']},
  {reply:'It costs 99 coins.',evidenceIds:['folio']},
  {reply:'A fact.',evidenceIds:[],trust:5},
  {reply:'A fact.',evidenceIds:[]},
 ])assert.equal(validNaturalReply(output,packet),false);
 for(const issue of Object.keys(verdict)){
  let count=0;const result=await naturalNpcReply({packet,fallback:'Reviewed fallback.',generate:async()=>({output:++count===1?{reply:'The public folio is a sensible start.',evidenceIds:['folio']}:{...verdict,[issue]:false}})});
  assert.equal(result.reply,'Reviewed fallback.');assert.equal(result.source,'authored-fallback');
 }
 assert.equal((await naturalNpcReply({packet,fallback:'Offline fallback.',generate:async()=>{throw Error('offline');}})).reply,'Offline fallback.');
});
test('ordinary conversation never asks for dice; authored approaches, hard boundaries and evidence differ',()=>{
 for(const action of ['hello',"what's happening",'what map would help below?','how are you?'])assert.equal(request(at(),action),null);
 assert.equal(request().skill,'Persuasion');assert.equal(request(at(),'I lie to persuade you to share private annotations').skill,'Deception');
 assert.equal(request(at(),"I'd like to see your unfinished notes").skill,'Persuasion');
 assert.equal(request(at(),'Can you explain what private annotations are?'),null);
 const threat=request(at(),'I threaten you to share the private annotations');assert.equal(threat.kind,'automatic');assert.equal(threat.result,'boundary');
 assert.equal(request({ ...at(),flags:{...at().flags,citySealReported:true}}).kind,'automatic');
 const insight=request(at(),'Could I read your intentions?');assert.equal(insight.skill,'Insight');assert.equal(insight.ability,'Wisdom');
});
test('success, failure, retries and boundaries persist per player and cannot farm trust',()=>{
 const world=at(),plan=request(world);
 const failed=resolveSocialAttempt({definition:roads,world,playerId:'p',pending:plan,success:false});assert.equal(failed.accepted,true);
 assert.equal(request(failed.state).kind,'blocked');assert.equal(request(failed.state,'Please convince her to show private annotations').kind,'blocked');
 assert.equal(resolveSocialAttempt({definition:roads,world:failed.state,playerId:'p',pending:plan,success:true}).accepted,false);
 assert.equal(npcRelationship(failed.state,npcId,'other').respect,0);
 const updated={...failed.state,flags:{...failed.state.flags,citySealReported:true}};
 const evidence=request(updated);assert.equal(evidence.kind,'automatic');
 const granted=resolveSocialAttempt({definition:roads,world:updated,playerId:'p',pending:evidence,success:true});assert.equal(granted.state.flags.cityLethrielAnnotationsShared,true);assert.equal(npcRelationship(granted.state,npcId,'p').trust,1);
 assert.equal(resolveSocialAttempt({definition:roads,world:granted.state,playerId:'p',pending:evidence,success:true}).accepted,false);
 const boundary=request(world,'I threaten you for private annotations');const refused=resolveSocialAttempt({definition:roads,world,playerId:'p',pending:boundary,success:true});assert.equal(refused.state.flags.cityLethrielAnnotationsShared,false);assert.equal(npcRelationship(refused.state,npcId,'p').fear,1);
 assert.deepEqual(world,at(),'caller state is not mutated');
});
test('stale checks cannot resolve in another room, for another player or after evidence changes',()=>{
 const world=at(),plan=request(world);
 for(const [state,playerId] of [[{...world,currentLocation:'city-delvers-last'},'p'],[world,'other'],[{...world,flags:{...world.flags,citySealReported:true}},'p']])assert.equal(resolveSocialAttempt({definition:roads,world:state,playerId,pending:plan,success:true}).accepted,false);
});
test('social authoring rejects invalid approaches, unsafe consequences and malformed personality data',()=>{
 assert.deepEqual(validateAdventure(roads).errors,[]);
 const definition=structuredClone(roads),contact=definition.story.npcs[npcId];contact.personality.traits='grumpy';contact.socialChallenges[0].approaches.MindControl={dc:100};contact.socialChallenges[0].success.effects=[{op:'set',path:'currentLocation',value:'city'}];
 const errors=validateAdventure(definition).errors.join(' ');assert.match(errors,/starting mood|traits/);assert.match(errors,/supported approaches/);assert.match(errors,/arbitrary state/);
});
function fixture(){const db=createDatabase(':memory:'),player=createPlayer(db,{partyId:'party-first-company',name:'Nigel',species:'Human',className:'Fighter'});selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');setPartyState(db,player.partyId,'world:eldervale-roads',at());return {db,player,say:text=>resolveAction(db,getPlayer(db,player.id),'speak',text),world:()=>getPartyState(db,player.partyId,'world:eldervale-roads')};}
test('actual speech and roll dispatch creates a real social check, commits failure and enforces no re-rolls',async()=>{
 const f=fixture();try{
  await f.say('could you share your private annotations please?');let pending=getPartyState(f.db,f.player.partyId,'pendingCheck:'+f.player.id);assert.equal(pending.skill,'Persuasion');assert.ok(pending.social);
  const result=await resolvePendingCheck(f.db,f.player,1);assert.equal(result.success,false);assert.equal(f.world().flags.cityLethrielAnnotationsShared,false);
  await f.say('please show your private annotations');assert.equal(getPartyState(f.db,f.player.partyId,'pendingCheck:'+f.player.id),null);
  const state=f.world();await f.say('what maps would help exploring down below?');assert.deepEqual(f.world(),state);assert.doesNotMatch(listVisibleEvents(f.db,f.player).at(-1).text,/gate wheel|sentinel|playable/);
 }finally{f.db.close();}
});
test('actual evidence bypass and Insight use existing controls; high dice cannot break a boundary',async()=>{
 const f=fixture();try{
  setPartyState(f.db,f.player.partyId,'world:eldervale-roads',at({citySealReported:true}));await f.say('could you share your private annotations?');assert.equal(getPartyState(f.db,f.player.partyId,'pendingCheck:'+f.player.id),null);assert.equal(f.world().flags.cityLethrielAnnotationsShared,true);
  await f.say('could I read your intentions?');assert.equal(getPartyState(f.db,f.player.partyId,'pendingCheck:'+f.player.id).ability,'Wisdom');await resolvePendingCheck(f.db,f.player,20);assert.equal(npcRelationship(f.world(),npcId,f.player.id).episodes.length,2);
  setPartyState(f.db,f.player.partyId,'world:eldervale-roads',at());await f.say('I threaten you to show private annotations');assert.equal(getPartyState(f.db,f.player.partyId,'pendingCheck:'+f.player.id),null);assert.equal(f.world().flags.cityLethrielAnnotationsShared,false);
 }finally{f.db.close();}
});
test('natural conversation history persists per player across visits and explicit reset clears only active history',async()=>{
 const f=fixture();try{
  await f.say('hello');const key=`npcNaturalHistory:eldervale-roads:${npcId}:${f.player.id}`;assert.equal(getPartyState(f.db,f.player.partyId,key).length,1);
  await f.say("what's happening");assert.equal(getPartyState(f.db,f.player.partyId,key).length,2);
  assert.deepEqual(f.world(),at());
  setPartyState(f.db,f.player.partyId,'npcNaturalHistory:other:someone:p',[{reply:'Preserve other chapter.'}]);
  resetPartyStory(f.db,f.player.partyId);assert.equal(getPartyState(f.db,f.player.partyId,key),null);assert.ok(getPartyState(f.db,f.player.partyId,'npcNaturalHistory:other:someone:p'));
 }finally{f.db.close();}
});
test('social roll resolution is atomic: persistence failure restores the pending check and leaves relationships untouched',async()=>{
 const f=fixture();try{
  await f.say('could you share your private annotations?');const before=f.world(),count=listVisibleEvents(f.db,f.player).length;
  f.db.exec("CREATE TEMP TRIGGER fail_social BEFORE UPDATE ON party_state WHEN NEW.key='world:eldervale-roads' BEGIN SELECT RAISE(ABORT,'test write failure'); END;");
  await assert.rejects(()=>resolvePendingCheck(f.db,f.player,20),/test write failure/);
  assert.deepEqual(f.world(),before);assert.ok(getPartyState(f.db,f.player.partyId,'pendingCheck:'+f.player.id));assert.equal(listVisibleEvents(f.db,f.player).length,count);
 }finally{f.db.close();}
});
test('a natural twenty uses the ordinary total, not automatic social success',async()=>{
 const f=fixture();try{
  await f.say('could you share your private annotations?');const key='pendingCheck:'+f.player.id,pending=getPartyState(f.db,f.player.partyId,key);
  setPartyState(f.db,f.player.partyId,key,{...pending,dc:25,modifier:0});const result=await resolvePendingCheck(f.db,f.player,20);assert.equal(result.success,false);assert.equal(f.world().flags.cityLethrielAnnotationsShared,false);
 }finally{f.db.close();}
});
test('normal walking and observation preserve confirmed relationships and do not leak one player’s state into another',async()=>{
 const f=fixture();try{
  setPartyState(f.db,f.player.partyId,'world:eldervale-roads',at({citySealReported:true}));await f.say('could you share private annotations?');
  const relationship=npcRelationship(f.world(),npcId,f.player.id);assert.equal(relationship.trust,1);
  assert.ok(f.world().outcomes.some(outcome=>outcome.canonicalEvents?.some(event=>event.type==='social-state-changed')));
  await resolveAction(f.db,getPlayer(f.db,f.player.id),'act','go to Three Knots Ropeworks');await resolveAction(f.db,getPlayer(f.db,f.player.id),'act','look around');await resolveAction(f.db,getPlayer(f.db,f.player.id),'act','go to Moth & Compass Maps');
  assert.deepEqual(npcRelationship(f.world(),npcId,f.player.id),relationship);
  const other=createPlayer(f.db,{partyId:f.player.partyId,name:'Another',species:'Elf',className:'Fighter'});
  assert.equal(npcRelationship(f.world(),npcId,other.id).trust,0);
  assert.equal(getPartyState(f.db,f.player.partyId,`npcNaturalHistory:eldervale-roads:${npcId}:${other.id}`),null);
 }finally{f.db.close();}
});
test('history can clarify a recent still-eligible fact but cannot resurrect withdrawn private knowledge',()=>{
 const world=at({cityLethrielAnnotationsShared:true}),projection=projectNpc(npc,world);
 const memory=[{evidenceIds:['maps-private-annotation'],reply:'An earlier answer.'}];
 assert.ok(conversationEvidence(npc,projection,world,'what did you mean by those notes?',memory).some(entry=>entry.id==='maps-private-annotation'));
 assert.ok(!conversationEvidence(npc,projectNpc(npc,at()),at(),'what did you mean by those notes?',memory).some(entry=>entry.id==='maps-private-annotation'));
});
