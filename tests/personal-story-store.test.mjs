import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createDatabase,createPlayer,getParty,setPartyState,getPartyState,listVisibleEvents} from '../server/database.mjs';
import {createPersonalStoryStore} from '../scripts/lib/personal-story-store.mjs';
import {adventureDefinition} from '../server/adventure-registry.mjs';

const policy={ownerName:'Nima Dawnstone',people:[{id:'sister',name:'Maren'}],places:[{id:'last',name:'The Last Lantern'},{id:'bakery',name:'Hearthcrumb Bakery'}],limit:2};
const proposal={personId:'sister',placeId:'last',activity:'talked',impression:'amusing',topic:'mending'};
function fixture(filename=':memory:'){
 const db=createDatabase(filename),player=createPlayer(db,{partyId:'party-first-company',name:'Tester',species:'Human',className:'Fighter'});
 const scope={partyId:player.partyId,adventureId:getParty(db,player.partyId).activeAdventureId,npcId:'nima'};
 const worldKey='world:'+adventureDefinition(scope.adventureId).id;
 setPartyState(db,player.partyId,worldKey,{location:'wall',revision:3});
 return {db,player,scope,worldKey,store:createPersonalStoryStore(db)};
}
const draft=(f,overrides={})=>({id:'turn-1',playerId:f.player.id,expectedRevision:0,worldToken:f.store.load(f.scope,policy,f.player.id).worldToken,reply:'Maren and I talked about mending at the Last Lantern. It was amusing.',memory:{proposal},...overrides});
const count=(f,table)=>f.db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n;

test('experimental store prepares/reloads unheard stories, preserves provenance and private hearing flags',()=>{
 const f=fixture();try{
  const before=JSON.stringify(getPartyState(f.db,f.player.partyId,f.worldKey));
  assert.equal(f.store.prepare(f.scope,policy,f.player.id,0,[proposal]).revision,1);
  const loaded=createPersonalStoryStore(f.db).load(f.scope,policy,f.player.id);
  assert.equal(loaded.revision,1);assert.equal(loaded.stories[0].toldToThisPlayer,false);assert.equal(loaded.stories[0].verified,false);
  assert.equal(loaded.stories[0].provenance,'improvised-personal');
  assert.equal(JSON.stringify(getPartyState(f.db,f.player.partyId,f.worldKey)),before);
 }finally{f.db.close();}
});

test('published dialogue, story and idempotent receipt are one transaction',()=>{
 const f=fixture();try{
  const before=listVisibleEvents(f.db,f.player).length,input=draft(f),result=f.store.publish(f.scope,policy,input);
  assert.equal(result.revision,1);assert.equal(result.replayed,false);
  assert.equal(f.store.load(f.scope,policy,f.player.id).stories[0].toldToThisPlayer,true);
  assert.equal(listVisibleEvents(f.db,f.player).length,before+1);
  assert.deepEqual(f.store.publish(f.scope,policy,input),{...result,replayed:true});
  assert.equal(listVisibleEvents(f.db,f.player).length,before+1);assert.equal(count(f,'prototype_npc_story_publications'),1);
  assert.throws(()=>f.store.publish(f.scope,policy,{...input,reply:'Changed reply.'}),{code:'story-publication-conflict'});
 }finally{f.db.close();}
});

test('failed dialogue insertion rolls back memory; failed receipt insertion also rolls back published event',()=>{
 for(const table of ['events','prototype_npc_story_publications']){
  const f=fixture();try{
   const before=listVisibleEvents(f.db,f.player).length,input=draft(f);
   f.db.exec(`CREATE TRIGGER fail_publication BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'test failure'); END;`);
   assert.throws(()=>f.store.publish(f.scope,policy,input),/test failure/);
   assert.equal(f.store.load(f.scope,policy,f.player.id).revision,0);
   assert.equal(count(f,'prototype_npc_stories'),0);assert.equal(count(f,'prototype_npc_story_publications'),0);
   assert.equal(listVisibleEvents(f.db,f.player).length,before);
   f.db.exec('DROP TRIGGER fail_publication');assert.equal(f.store.publish(f.scope,policy,input).replayed,false);
  }finally{f.db.close();}
 }
});

test('stale memory revisions and changed worlds reject without publishing or overwriting',()=>{
 const f=fixture();try{
  const stale=draft(f);f.store.prepare(f.scope,policy,f.player.id,0,[proposal]);
  assert.throws(()=>f.store.publish(f.scope,policy,stale),{code:'story-revision-conflict'});
  const changed=draft(f,{expectedRevision:1,memory:{recallId:'s1'}});
  setPartyState(f.db,f.player.partyId,f.worldKey,{location:'elsewhere',revision:4});
  assert.throws(()=>f.store.publish(f.scope,policy,changed),{code:'story-world-conflict'});
  assert.equal(f.store.load(f.scope,policy,f.player.id).revision,1);
  assert.equal(f.store.load(f.scope,policy,f.player.id).stories[0].toldToThisPlayer,false);
  assert.equal(count(f,'prototype_npc_story_publications'),0);
 }finally{f.db.close();}
});

test('scopes, policy changes and extra authority fields fail closed',()=>{
 const f=fixture();try{
  const other=createPlayer(f.db,{partyId:'party-first-company',name:'Other',species:'Human',className:'Fighter'});
  f.store.publish(f.scope,policy,draft(f));
  assert.equal(f.store.load(f.scope,policy,other.id).stories[0].toldToThisPlayer,false);
  const reordered={npcId:f.scope.npcId,adventureId:f.scope.adventureId,partyId:f.scope.partyId};
  assert.equal(f.store.load(reordered,policy,f.player.id).revision,1);
  assert.deepEqual(f.store.load({...f.scope,npcId:'another'},policy,f.player.id).stories,[]);
  assert.throws(()=>f.store.load({...f.scope,adventureId:'other'},policy,f.player.id),/outside/);
  assert.throws(()=>f.store.load(f.scope,policy,'unknown'),/outside/);
  assert.throws(()=>f.store.load(f.scope,{...policy,ownerName:'Another'},f.player.id),/migration/);
  assert.throws(()=>f.store.publish(f.scope,policy,{...draft(f),effects:['grant key']}),/Invalid/);
 }finally{f.db.close();}
});

test('corrupt stored snapshots cannot partially load or be silently overwritten',()=>{
 const f=fixture();try{
  f.store.prepare(f.scope,policy,f.player.id,0,[proposal]);
  const row=f.db.prepare('SELECT * FROM prototype_npc_stories').get();
  const corrupt=JSON.parse(row.snapshot_json);corrupt[0].stories[0].verified=true;
  const bytes=JSON.stringify(corrupt);f.db.prepare('UPDATE prototype_npc_stories SET snapshot_json=?').run(bytes);
  assert.throws(()=>f.store.load(f.scope,policy,f.player.id));
  assert.throws(()=>f.store.prepare(f.scope,policy,f.player.id,1,[]));
  assert.equal(f.db.prepare('SELECT snapshot_json FROM prototype_npc_stories').get().snapshot_json,bytes);
 }finally{f.db.close();}
});

test('savepoints respect outer game transactions rather than committing them early',()=>{
 const f=fixture();try{
  f.db.exec('BEGIN');f.store.publish(f.scope,policy,draft(f));f.db.exec('ROLLBACK');
  assert.equal(f.store.load(f.scope,policy,f.player.id).revision,0);assert.equal(count(f,'prototype_npc_story_publications'),0);
 }finally{f.db.close();}
});

test('failed recall publication preserves prepared unheard memory byte-for-byte',()=>{
 const f=fixture();try{
  f.store.prepare(f.scope,policy,f.player.id,0,[proposal]);
  const original=f.db.prepare('SELECT * FROM prototype_npc_stories').get();
  const input=draft(f,{expectedRevision:1,memory:{recallId:'s1'}});
  f.db.exec("CREATE TRIGGER fail_recall BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT,'recall failed'); END;");
  assert.throws(()=>f.store.publish(f.scope,policy,input),/recall failed/);
  assert.deepEqual(f.db.prepare('SELECT * FROM prototype_npc_stories').get(),original);
  assert.equal(f.store.load(f.scope,policy,f.player.id).stories[0].toldToThisPlayer,false);
 }finally{f.db.close();}
});

test('world guard uses the registered canonical key and rejects a missing snapshot',()=>{
 const f=fixture();try{
  const input=draft(f);
  setPartyState(f.db,f.player.partyId,'world:'+f.scope.adventureId,{unrelated:true});
  assert.equal(f.store.load(f.scope,policy,f.player.id).worldToken,input.worldToken);
  setPartyState(f.db,f.player.partyId,f.worldKey,null);
  assert.throws(()=>f.store.publish(f.scope,policy,input),/canonical world snapshot/);
  assert.equal(count(f,'prototype_npc_stories'),0);assert.equal(count(f,'prototype_npc_story_publications'),0);
 }finally{f.db.close();}
});

test('actual disk reopen and independent connections retain notes and detect stale writers',()=>{
 const folder=mkdtempSync(join(tmpdir(),'hearthbound-story-store-')),filename=join(folder,'prototype.sqlite');
 let f,second;
 try{
  f=fixture(filename);f.store.prepare(f.scope,policy,f.player.id,0,[proposal]);
  const saved={scope:f.scope,player:f.player};f.db.close();f=null;
  const db=new DatabaseSync(filename);f={...saved,db,store:createPersonalStoryStore(db)};
  second=new DatabaseSync(filename);const competitor=createPersonalStoryStore(second);
  assert.equal(competitor.load(f.scope,policy,f.player.id).revision,1);
  const input=draft(f,{expectedRevision:1,memory:{recallId:'s1'}});
  second.exec('BEGIN IMMEDIATE');db.exec('PRAGMA busy_timeout=1');
  assert.throws(()=>f.store.publish(f.scope,policy,input),/locked/);
  second.exec('ROLLBACK');
  assert.equal(f.store.load(f.scope,policy,f.player.id).revision,1);
  assert.equal(count(f,'prototype_npc_story_publications'),0);
  f.store.publish(f.scope,policy,input);
  assert.throws(()=>competitor.publish(f.scope,policy,{...input,id:'other-turn'}),{code:'story-revision-conflict'});
  assert.equal(competitor.load(f.scope,policy,f.player.id).revision,2);
  assert.equal(count(f,'prototype_npc_story_publications'),1);
 }finally{
  second?.close();f?.db.close();
  for(const suffix of ['','-wal','-shm'])rmSync(filename+suffix,{force:true});
  rmdirSync(folder);
 }
});
