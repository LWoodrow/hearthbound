// Experimental persistence adapter. No live dispatcher imports this module.
// Callers are trusted server orchestration, NEVER raw model capabilities.
import {createHash} from 'node:crypto';
import {createPersonalStoryLedger} from '../../server/npc-personal-stories.mjs';
import {addEvent,getParty,getPlayer,getPartyState} from '../../server/database.mjs';
import {safeNpcSpeech} from '../../server/npc-natural-dialogue.mjs';
import {adventureDefinition} from '../../server/adventure-registry.mjs';

const fail=(message,code='story-storage-invalid')=>{throw Object.assign(new Error(message),{code});};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text=value=>typeof value==='string'&&value.trim()&&value.length<=150;
const revision=value=>Number.isSafeInteger(value)&&value>=0;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

export function createPersonalStoryStore(db){
 // Explicit construction only: no production migration or startup hook.
 db.exec(`CREATE TABLE IF NOT EXISTS prototype_npc_stories (
  scope_key TEXT PRIMARY KEY, revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS prototype_npc_story_publications (
  scope_key TEXT NOT NULL, publication_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
  event_id INTEGER NOT NULL, revision INTEGER NOT NULL,
  PRIMARY KEY(scope_key,publication_id));`);
 function read(scope,policy,playerId){
  const ledger=createPersonalStoryLedger();ledger.view(scope,policy,playerId);
  const key=JSON.stringify([scope.partyId,scope.adventureId,scope.npcId]);
  const row=db.prepare('SELECT revision,snapshot_json FROM prototype_npc_stories WHERE scope_key=?').get(key);
  if(row){
   if(!revision(row.revision)||row.revision===0||row.snapshot_json.length>100000)fail('Invalid personal-story storage envelope.');
   const snapshot=JSON.parse(row.snapshot_json);
   if(!Array.isArray(snapshot)||snapshot.length!==1)fail('Stored personal-story scope does not match.');
   ledger.restore(snapshot);
   const saved=ledger.snapshot()[0]?.scope;
   if(!saved||JSON.stringify([saved.partyId,saved.adventureId,saved.npcId])!==key)fail('Stored personal-story scope does not match.');
   ledger.view(scope,policy,playerId);
  }
  return {ledger,key,revision:row?.revision||0};
 }
 function eligible(scope,playerId){
  const party=getParty(db,scope.partyId),player=getPlayer(db,playerId);
  if(!party||party.activeAdventureId!==scope.adventureId||player?.partyId!==scope.partyId)fail('Personal-story publication is outside the active party/adventure.');
 }
 const worldToken=scope=>{
  const definition=adventureDefinition(scope.adventureId);
  if(!definition)fail('A registered adventure is required for publication.');
  const world=getPartyState(db,scope.partyId,'world:'+definition.id);
  if(!world||typeof world!=='object'||Array.isArray(world))fail('A canonical world snapshot is required for publication.');
  return hash(world);
 };
 function atomic(work){
  db.exec('SAVEPOINT prototype_personal_story');
  try{const result=work();db.exec('RELEASE prototype_personal_story');return result;}
  catch(error){db.exec('ROLLBACK TO prototype_personal_story');db.exec('RELEASE prototype_personal_story');throw error;}
 }
 function write(state,expectedRevision){
  if(!revision(expectedRevision)||expectedRevision!==state.revision)fail('Personal-story revision changed.','story-revision-conflict');
  const snapshot=state.ledger.snapshot();
  if(!snapshot.length)return state.revision;
  const next=state.revision+1;if(!revision(next))fail('Personal-story revision limit reached.');
  if(state.revision===0)db.prepare('INSERT INTO prototype_npc_stories VALUES (?,?,?)').run(state.key,next,JSON.stringify(snapshot));
  else if(db.prepare('UPDATE prototype_npc_stories SET revision=?,snapshot_json=? WHERE scope_key=? AND revision=?').run(next,JSON.stringify(snapshot),state.key,expectedRevision).changes!==1)fail('Personal-story revision changed.','story-revision-conflict');
  return next;
 }
 return {
  load(scope,policy,playerId){
   eligible(scope,playerId);const state=read(scope,policy,playerId);
   return {revision:state.revision,worldToken:worldToken(scope),stories:state.ledger.view(scope,policy,playerId)};
  },
  prepare(scope,policy,playerId,expectedRevision,proposals){
   return atomic(()=>{
    eligible(scope,playerId);const state=read(scope,policy,playerId);
    state.ledger.prepare(scope,policy,proposals);
    return {revision:write(state,expectedRevision)};
   });
  },
  publish(scope,policy,publication){
   if(!exact(publication,['id','playerId','expectedRevision','worldToken','reply','memory'])||!text(publication.id)||!text(publication.playerId)||!revision(publication.expectedRevision)||typeof publication.worldToken!=='string'||!/^[a-f0-9]{64}$/.test(publication.worldToken)||!safeNpcSpeech(publication.reply))fail('Invalid personal-story publication.');
   const memory=publication.memory;
   if(!exact(memory,['proposal'])&&!exact(memory,['recallId']))fail('Invalid personal-story memory operation.');
   return atomic(()=>{
    eligible(scope,publication.playerId);
    const state=read(scope,policy,publication.playerId),fingerprint=hash({policy,publication});
    const old=db.prepare('SELECT * FROM prototype_npc_story_publications WHERE scope_key=? AND publication_id=?').get(state.key,publication.id);
    if(old){
     if(old.fingerprint!==fingerprint)fail('Publication ID reused with different content.','story-publication-conflict');
     return {eventId:old.event_id,revision:old.revision,replayed:true};
    }
    if(worldToken(scope)!==publication.worldToken)fail('World changed before personal-story publication.','story-world-conflict');
    if(Object.hasOwn(memory,'proposal'))state.ledger.commit(scope,policy,memory.proposal,publication.playerId);
    else state.ledger.recall(scope,policy,memory.recallId,publication.playerId);
    const next=write(state,publication.expectedRevision);
    // Fixed event authority/visibility, no caller-supplied effects or payload.
    // The real dispatcher must run all its guards BEFORE using this adapter.
    const eventId=addEvent(db,{partyId:scope.partyId,adventureId:scope.adventureId,visibility:'player',playerId:publication.playerId,kind:'npc-dialogue',speaker:policy.ownerName,text:publication.reply,payload:{personalStoryPrototype:true}});
    db.prepare('INSERT INTO prototype_npc_story_publications VALUES (?,?,?,?,?)').run(state.key,publication.id,fingerprint,eventId,next);
    return {eventId,revision:next,replayed:false};
   });
  },
 };
}
