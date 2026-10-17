import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase,createPlayer,getPlayer,getParty,selectAdventure,setPartyState,getPartyState,addEvent,listVisibleEvents,listEncounteredSpeakers,resetPartyStory} from '../server/database.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import {resolveAction} from '../server/dm.mjs';
import {conversationProgress,createConversationSession} from '../server/npc-conversation-session.mjs';
import {generateStructured} from '../server/ai-transport.mjs';
import {visibleNpcProfiles} from '../shared/portrait-catalogue.mjs';
import {beginCombatAttack,resolveCombatRoll,startWorkshopCombat} from '../server/combat.mjs';
import roads from '../server/adventures/eldervale-roads.mjs';

const speech=reply=>({kind:'speech',reply,ids:[],approach:''});
function fixture(){
 const db=createDatabase(':memory:'),player=createPlayer(db,{partyId:'party-first-company',name:'Review',species:'Human',className:'Fighter',equipmentChoice:'gold'});
 selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');
 const world=createCanonicalState(roads,{currentLocation:'city-delvers-memorial'});setPartyState(db,player.partyId,'world:eldervale-roads',world);
 return {db,player,world,history:`npcNaturalHistory:eldervale-roads:city-delvers-memorial-resident:${player.id}`};
}
const say=(f,text,generate,player=f.player)=>resolveAction(f.db,getPlayer(f.db,player.id),'speak',text,{npcGenerate:generate});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};

test('event window returns the newest 250 in display order without losing encountered portraits or privacy',()=>{
 const f=fixture();try{
  addEvent(f.db,{partyId:f.player.partyId,visibility:'public',kind:'narration',speaker:'Merrin Holt',text:'An early encounter.'});
  const other=createPlayer(f.db,{partyId:f.player.partyId,name:'Other',species:'Human',className:'Fighter'});
  addEvent(f.db,{partyId:f.player.partyId,visibility:'player',playerId:other.id,kind:'narration',speaker:'Private stranger',text:'Not visible.'});
  addEvent(f.db,{partyId:f.player.partyId,visibility:'dm',kind:'system',speaker:'Secret stranger',text:'Secret.'});
  for(let i=0;i<270;i++)addEvent(f.db,{partyId:f.player.partyId,visibility:'public',kind:'narration',speaker:'Review',text:'entry-'+i});
  const events=listVisibleEvents(f.db,f.player);assert.equal(events.length,250);assert.equal(events[0].text,'entry-20');assert.equal(events.at(-1).text,'entry-269');
  assert.ok(events.every((event,i)=>!i||event.id>events[i-1].id));
  const speakers=listEncounteredSpeakers(f.db,f.player);assert.ok(speakers.some(row=>row.speaker==='Merrin Holt'));
  assert.ok(!speakers.some(row=>/stranger/.test(row.speaker)));
  assert.ok(visibleNpcProfiles(roads,speakers)['Merrin Holt']);
 }finally{f.db.close();}
});

test('overlapping same-player NPC turns reject explicitly, preserve progress and do not overwrite accepted memory',async()=>{
 const f=fixture(),entered=deferred(),release=deferred();let first;
 try{
  first=say(f,'Hello Nima',async()=>{entered.resolve();await release.promise;return speech('The first reply.');});await entered.promise;
  const progress=conversationProgress(f.player.partyId,f.player.id);let calls=0;
  const second=await say(f,'How are you Nima?',async()=>{calls++;return speech('The second reply.');});
  assert.equal(second.rule,'conversation-in-progress');assert.equal(second.accepted,false);assert.equal(calls,0);
  assert.equal(conversationProgress(f.player.partyId,f.player.id).startedAt,progress.startedAt);
  release.resolve();await first;
  await say(f,'How are you Nima?',async()=>speech('The later accepted reply.'));
  const history=getPartyState(f.db,f.player.partyId,f.history);assert.equal(history.length,2);assert.equal(history.at(-1).reply,'The later accepted reply.');
  assert.equal(conversationProgress(f.player.partyId,f.player.id),null);
 }finally{release.resolve();await first;f.db.close();}
});

test('concurrent different-player conversations retain both shared transcript entries and private histories',async()=>{
 const f=fixture(),entered=deferred(),release=deferred();let first;
 try{
  const other=createPlayer(f.db,{partyId:f.player.partyId,name:'Other',species:'Human',className:'Fighter'});
  first=say(f,'Hello Nima',async()=>{entered.resolve();await release.promise;return speech('The first reply.');});await entered.promise;
  await say(f,'Hello Nima',async()=>speech('The other reply.'),other);release.resolve();await first;
  assert.equal(getPartyState(f.db,f.player.partyId,'npcConversation:eldervale-roads:city-delvers-memorial-resident').length,2);
  assert.equal(getPartyState(f.db,f.player.partyId,f.history).length,1);
  assert.equal(getPartyState(f.db,f.player.partyId,`npcNaturalHistory:eldervale-roads:city-delvers-memorial-resident:${other.id}`).length,1);
 }finally{release.resolve();await first;f.db.close();}
});

test('adventure switch, switch-away-and-back and reset invalidate delayed NPC replies even at the same world revision',async()=>{
 for(const change of ['switch','return','reset']){
  const f=fixture();try{
   const result=await say(f,'Hello Nima',async()=>{
    if(change==='reset'){resetPartyStory(f.db,f.player.partyId);setPartyState(f.db,f.player.partyId,'world:eldervale-roads',f.world);}
    else{const worldId=getParty(f.db,f.player.partyId).worldId;selectAdventure(f.db,f.player.partyId,worldId+'-lantern-below');if(change==='return')selectAdventure(f.db,f.player.partyId,worldId+'-eldervale-roads');}
    return speech('This stale reply must not be published.');
   });
   assert.equal(result.rule,'conversation-context-changed');assert.equal(result.accepted,false);
   assert.equal(getPartyState(f.db,f.player.partyId,f.history),null);
   assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM events WHERE speaker='Nima Dawnstone'").get().n,0);
  }finally{f.db.close();}
 }
});

test('failed NPC event publication rolls back history, shared memory and active partner, then releases the turn lock',async()=>{
 const f=fixture();try{
  await say(f,'Hello Nima',async()=>speech('A previously accepted reply.'));
  const key='npcConversation:eldervale-roads:city-delvers-memorial-resident';
  const history=getPartyState(f.db,f.player.partyId,f.history),shared=getPartyState(f.db,f.player.partyId,key);
  const count=f.db.prepare("SELECT COUNT(*) AS n FROM events WHERE speaker='Nima Dawnstone'").get().n;
  f.db.exec("CREATE TRIGGER fail_npc_reply BEFORE INSERT ON events WHEN NEW.speaker='Nima Dawnstone' BEGIN SELECT RAISE(ABORT,'test publication failure'); END;");
  await assert.rejects(say(f,'How are you Nima?',async()=>speech('An invisible reply.')),/test publication failure/);
  assert.deepEqual(getPartyState(f.db,f.player.partyId,f.history),history);assert.deepEqual(getPartyState(f.db,f.player.partyId,key),shared);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM events WHERE speaker='Nima Dawnstone'").get().n,count);
  f.db.exec('DROP TRIGGER fail_npc_reply');await say(f,'Hello Nima',async()=>speech('A recovered reply.'));
  assert.equal(getPartyState(f.db,f.player.partyId,f.history).length,2);
 }finally{f.db.close();}
});

test('empty successful AI responses remain invalid-output through actual transport and session diagnostics',async()=>{
 for(const content of ['',null,undefined]){
  const session=createConversationSession({publish:false});
  await assert.rejects(session.generate({kind:'npc-dialogue',generation:{timeoutMs:1000}},()=>generateStructured({provider:'llamacpp',model:'test',baseUrl:'http://test'},[],{}, {},async()=>({ok:true,json:async()=>({choices:[{message:{content}}]})}))),{code:'invalid-output'});
  assert.equal(session.close().failure,'invalid-output');
 }
});

test('unarmed hits resolve fixed damage immediately, including critical hits and a killing blow',()=>{
 for(const critical of [false,true]){
  const f=fixture();try{
   startWorkshopCombat(f.db,f.player,'training-dummy');const combat=getPartyState(f.db,f.player.partyId,'combat');
   combat.turnIndex=combat.order.findIndex(entry=>entry.id===f.player.id);combat.pendingRoll=null;combat.enemies[0].hp=critical?3:20;
   setPartyState(f.db,f.player.partyId,'combat',combat);beginCombatAttack(f.db,f.player,'Unarmed Strike');
   const result=resolveCombatRoll(f.db,f.player,20,critical?20:19);assert.equal(result.fixedDamage,3);
   const saved=getPartyState(f.db,f.player.partyId,'combat');assert.equal(saved.pendingRoll,null);
   assert.ok(!listVisibleEvents(f.db,f.player).some(event=>/Roll 0d1/.test(event.text)));
   if(critical)assert.equal(saved.outcome,'victory');
  }finally{f.db.close();}
 }
});

test('an older save stuck on zero-dice unarmed damage resolves without adding a fictional die roll',()=>{
 const f=fixture();try{
  startWorkshopCombat(f.db,f.player,'training-dummy');const combat=getPartyState(f.db,f.player.partyId,'combat');
  combat.turnIndex=combat.order.findIndex(entry=>entry.id===f.player.id);combat.enemies[0].hp=20;
  combat.pendingRoll={kind:'damage',playerId:f.player.id,targetId:combat.enemies[0].id,weapon:{name:'Unarmed Strike'},diceCount:0,dieSides:1,modifier:2};
  setPartyState(f.db,f.player.partyId,'combat',combat);
  const result=resolveCombatRoll(f.db,f.player,1,0);assert.equal(result.damage,3);assert.deepEqual(result.rolls,[]);
  assert.equal(getPartyState(f.db,f.player.partyId,'combat').pendingRoll,null);
 }finally{f.db.close();}
});
