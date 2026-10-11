import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import roads from '../server/adventures/eldervale-roads.mjs';
import {cityAtlases} from '../server/adventures/eldervale-city.mjs';
import {createCanonicalState,resolveAuthoredInteraction,canonicalStage} from '../server/interaction-engine.mjs';
import {resolveWorldAction,visibleLocationFeatures} from '../server/world-state.mjs';
import {projectLocalAtlas,regionalAtlasView,regionalTravelCommand} from '../server/regional-atlas.mjs';
import {projectNpc} from '../server/scene-projection.mjs';
import {createDatabase,buildLobby,createPlayer,selectAdventure,setPartyState,getPartyState,getPlayer,listVisibleEvents} from '../server/database.mjs';
import {resolveAction} from '../server/dm.mjs';
const at=(id,flags={})=>createCanonicalState(roads,{currentLocation:id,visited:[id],flags});
const act=(state,action)=>resolveAuthoredInteraction({definition:roads,state,action,mode:'act'});
const members=cityAtlases.find(atlas=>atlas.id==='city-delvers').places;
test('every Delvers public destination is one walk away; neighbouring districts and depths remain controlled',()=>{
 for(const source of members){
  const state=at(source.id),view=projectLocalAtlas(state);
  for(const target of members.filter(target=>target.id!==source.id)){
   assert.equal(view.sites.find(site=>site.id===target.id).available,true);
   const moved=resolveWorldAction({definition:roads,state,action:'go to '+target.name});
   assert.equal(moved.state.currentLocation,target.id);assert.deepEqual(moved.state.visited,[...new Set([...state.visited,target.id])]);
  }
 }
 const state=at('city-delvers-rope',{cityDescentBriefed:true});
 for(const destination of ['Rope Landing','Grand Exchange','Temple Steps'])assert.equal(resolveWorldAction({definition:roads,state,action:'go to '+destination}).state.currentLocation,state.currentLocation);
 assert.ok(projectLocalAtlas(state).sites.filter(site=>site.kind==='district-exit').every(site=>!site.available));
 assert.ok(projectLocalAtlas(state,'Finish combat first').sites.every(site=>!site.available));
});
test('all destinations have locally present authored residents; unseen names stay off the map',()=>{
 for(const member of members){
  const npcs=Object.values(roads.story.npcs).filter(npc=>npc.locations.includes(member.id));assert.ok(npcs.length>0,member.id);
  const features=visibleLocationFeatures(roads,at(member.id));
  assert.ok(npcs.every(npc=>features.some(feature=>feature.label===npc.name)));
 }
 const state=at('city-delvers-last'),view=projectLocalAtlas(state);assert.ok(view.sites.filter(site=>!state.visited.includes(site.id)).every(site=>site.npcs.length===0));
 assert.equal(roads.story.npcs['city-delvers-rope-resident'].role,'Gnome ropeworker');
 assert.ok(roads.story.npcs['city-delvers-guild-resident'].role.startsWith('Dragonborn'));
});
test('preparation is linked, local, persistent and separate from descent permission or inventory rewards',()=>{
 let state=at('city-delvers-board');assert.equal(act(state,'register expedition plan').accepted,false);
 for(const [location,text,name] of [
  ['city-delvers-maps','read public survey folio','cityDescentBriefed'],
  ['city-delvers-rope','tie practice rope','cityPastimecity-delvers-rope'],
  ['city-delvers-gear','check expedition kit','cityDelversKitChecked'],
  ['city-delvers-board','register expedition plan','cityDelversPlanRegistered'],
 ]){
  state={...state,currentLocation:location};const result=act(state,text);assert.equal(result.accepted,true,text);state=result.state;assert.equal(state.flags[name],true);
  assert.deepEqual(act(state,text).state,state,'repeat does not grant a second effect');
 }
 assert.equal(state.currentLocation,'city-delvers-board');assert.equal(canonicalStage(roads,state),0);
 assert.deepEqual(state.itemOwners,at('city-delvers-board').itemOwners);
 assert.ok(projectNpc(roads.story.npcs['city-delvers-board-resident'],state).facts.some(fact=>fact.includes('Your visit is remembered')));
 const descent=resolveWorldAction({definition:roads,state:at('city-delvers-last',{cityDescentBriefed:true}),action:'descend'});
 assert.equal(descent.state.currentLocation,'city-under-landing','optional preparation adds no new descent gate');
});
test('promises and notices are local contributions; survey comparison requires the real Hester report',()=>{
 for(const [location,text,name] of [['city-delvers-memorial','leave return promise','cityDelversReturnPromise'],['city-delvers-hostel','leave return notice','cityDelversReturnNotice']]){
  const state=at(location),result=act(state,text);assert.equal(result.accepted,true);assert.equal(result.state.flags[name],true);assert.equal(result.state.currentLocation,location);assert.deepEqual(result.state.resources,state.resources);
 }
 assert.equal(act(at('city-delvers-guild'),'share survey record').accepted,false);
 const result=act(at('city-delvers-guild',{citySealReported:true}),'share survey record');assert.equal(result.accepted,true);assert.equal(result.state.flags.cityDelversSurveyCompared,true);
 assert.match(projectLocalAtlas(result.state).task,/recorded and compared/);
});
test('actual map button and DM walking enter only the selected building and preserve saved flags',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'hearthbound-public-')),db=createDatabase(join(folder,'test.sqlite'));
 try{
  const party=buildLobby(db).worlds[0].parties[0],player=createPlayer(db,{partyId:party.id,name:'Neil',species:'Human',className:'Fighter'});
  selectAdventure(db,party.id,party.worldId+'-eldervale-roads');setPartyState(db,party.id,'world:eldervale-roads',at('city-delvers-rope',{citySealCopied:true}));
  const text=regionalTravelCommand(db,player,'city-delvers-maps');await resolveAction(db,getPlayer(db,player.id),'act',text);
  const state=getPartyState(db,party.id,'world:eldervale-roads');assert.equal(state.currentLocation,'city-delvers-maps');assert.equal(state.flags.citySealCopied,true);
  assert.ok(!state.visited.includes('city-delvers-last'));assert.equal(state.previousLocation,'city-delvers-rope');
  assert.ok(regionalAtlasView(db,player).local.sites.find(site=>site.id==='city-delvers-gear').available);
  await resolveAction(db,getPlayer(db,player.id),'speak','hello Lethriel');
  assert.equal(listVisibleEvents(db,player).at(-1).speaker,'Lethriel Mossink');
  await resolveAction(db,getPlayer(db,player.id),'act','go to Grand Exchange');
  assert.equal(getPartyState(db,party.id,'world:eldervale-roads').currentLocation,'city-delvers-maps');
  await resolveAction(db,getPlayer(db,player.id),'act','go to Copper Buckle Outfitters');
  await resolveAction(db,getPlayer(db,player.id),'act','check expedition kit');
  assert.equal(getPartyState(db,party.id,'world:eldervale-roads').flags.cityDelversKitChecked,true);
  setPartyState(db,party.id,'combat',{active:true});assert.throws(()=>regionalTravelCommand(db,player,'city-delvers-last'),/combat/);
 }finally{db.close();rmSync(folder,{recursive:true,force:true});}
});
