import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import roads from '../server/adventures/eldervale-roads.mjs';
import {cityDistricts} from '../server/adventures/eldervale-city-data.mjs';
import {cityAtlases,cityOverview,undercityAtlas,withEldervaleCity} from '../server/adventures/eldervale-city.mjs';
import {createCanonicalState,resolveAuthoredInteraction,validateInteractions} from '../server/interaction-engine.mjs';
import {resolveWorldAction,visibleLocationDescription} from '../server/world-state.mjs';
import {projectLocalAtlas} from '../server/regional-atlas.mjs';
import {regionalAtlasView,regionalTravelCommand} from '../server/regional-atlas.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDatabase,buildLobby,createPlayer,selectAdventure,setPartyState,getPartyState,getPlayer} from '../server/database.mjs';
import {resolveAction} from '../server/dm.mjs';
import {resolveCombatRoll,startLocationEncounter} from '../server/combat.mjs';
const stateAt=(id,flags={})=>createCanonicalState(roads,{currentLocation:id,visited:['city',id],flags});
const act=(state,action)=>resolveAuthoredInteraction({definition:roads,state,action,mode:'act'});
const move=(state,to)=>resolveWorldAction({definition:roads,state,action:'Go to '+roads.locations[to].name,actorId:'test'});

test('twelve distinct city districts contain 96 destinations and preserve original regional geography',()=>{
 assert.equal(cityDistricts.length,12);assert.equal(cityDistricts.reduce((n,d)=>n+d.places.length,0),96);
 assert.equal(Object.keys(roads.locations).length,146);
 assert.ok(['city','village','market','ferry','wood','abbey','hill'].every(id=>roads.locations[id]));
 assert.equal(new Set(cityDistricts.flatMap(d=>d.places.map(p=>p[1]))).size,96);
 assert.deepEqual(validateInteractions(roads),[]);
 assert.ok(roads.story.npcs['city-lantern-resident'].role.includes('Halfling'));
 assert.ok(roads.story.npcs['city-lowwater-resident'].role.includes('Tiefling'));
});
test('every public city street is bidirectional and all 108 city nodes connect to the unchanged regional gateway',()=>{
 const publicIds=new Set(['city',...cityAtlases.flatMap(a=>a.places.map(p=>p.id))]);
 const seen=new Set(['city']),queue=['city'];
 while(queue.length){const id=queue.shift();for(const e of roads.locations[id].exits.filter(e=>publicIds.has(e.to))){assert.ok(roads.locations[e.to].exits.some(r=>r.to===id),id+' -> '+e.to);if(!seen.has(e.to)){seen.add(e.to);queue.push(e.to);}}}
 assert.equal(seen.size,109);
});
test('composition never accumulates shared atlas actions or mutates supplied original locations',()=>{
 const before=JSON.stringify(cityAtlases);const original=JSON.stringify(roads.locations.city);
 withEldervaleCity({...roads,locations:{...roads.locations,city:{...roads.locations.city,exits:[]}}});
 assert.equal(JSON.stringify(cityAtlases),before);assert.equal(JSON.stringify(roads.locations.city),original);
});
test('city artwork is a real local PNG and twelve maps use stable views rather than regenerated geography',()=>{
 const bytes=readFileSync(new URL('../public/art/maps/eldervale-city-v1.png',import.meta.url));
 assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.ok(bytes.length>100000);
 assert.ok(cityAtlases.every(a=>a.image===cityOverview.image&&a.imageViewport));
});
test('public district charts disclose geography but no unvisited resident names or underground places',()=>{
 const view=projectLocalAtlas(stateAt('city-lantern'));
 assert.equal(view.sites.length,9);assert.ok(view.sites.filter(s=>!s.current).every(s=>s.npcs.length===0));
 assert.ok(view.sites.every(s=>!s.id.startsWith('city-under-')));
 const remote=view.sites.find(s=>s.id==='city-lantern-lamps');assert.equal(remote.available,false);
 assert.equal(move(stateAt('city-lantern'),'city-lantern-lamps').accepted,false);
});
test('each local map has real adjacency, unique sketch blocks and regional parent city',()=>{
 const cityPlaces=cityAtlases.flatMap(a=>a.places);const rectangles=cityPlaces.map(p=>roads.locations[p.id].map);
 for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){const a=rectangles[i],b=rectangles[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
 for(const a of cityAtlases){assert.equal(a.root,'city');for(const [from,to] of a.links)assert.ok(roads.locations[from].exits.some(e=>e.to===to));}
});
test('a local repair changes canonical observations, persists and grants no main-story milestone',()=>{
 const before=stateAt('city-lantern-lamps');const repaired=act(before,'fasten loose lamp shutter');
 assert.equal(repaired.accepted,true);assert.equal(repaired.state.flags.cityHelplantern,true);
 assert.match(visibleLocationDescription(roads,repaired.state,before.currentLocation),/fastened/);
 const again=act(repaired.state,'fasten loose lamp shutter');assert.equal(again.state.flags.cityHelplantern,true);
 assert.equal(again.state.currentLocation,before.currentLocation);assert.equal(again.state.stage,before.stage);
 assert.equal(projectLocalAtlas(repaired.state).actions.some(a=>a.id==='city-lantern-help'),false,'completed actions are not offered as unfinished work');
});
test('all three descents need local briefing, never move on read and always allow safe physical return',()=>{
 for(const [surface,room,target,flag] of [['city-delvers-last','landing','descent safety ledger','cityDescentBriefed'],['city-mourning-crypt','steps','public crypt register','cityCryptBriefed'],['city-lowwater-pump','cistern','pumping station notice','cityPumpBriefed']]){
  const before=stateAt(surface);assert.equal(move(before,'city-under-'+room).accepted,false);
  const read=act(before,'read '+target);assert.equal(read.accepted,true);assert.equal(read.state.currentLocation,surface);assert.equal(read.state.flags[flag],true);
  const entered=move(read.state,'city-under-'+room);assert.equal(entered.accepted,true);
  assert.equal(move(entered.state,surface).accepted,true);
 }
});
test('upper survey reveals only current visited rooms and eligible adjacent destinations, not the deep boundary',()=>{
 const view=projectLocalAtlas(stateAt('city-under-landing'));
 assert.deepEqual(view.sites.map(p=>p.id).sort(),['city-delvers-last','city-under-crossing','city-under-landing']);
 assert.equal(view.schematic,true);assert.ok(!JSON.stringify(view).includes('Citadel Threshold'));
});
test('gate investigation and operation are separate, with independent evidence and persistent open backtracking',()=>{
 const before=stateAt('city-under-wheel');assert.equal(act(before,'turn marked wheel').accepted,false);
 for(const [location,target] of [['city-under-wheel','gate instructions'],['city-under-refuge','return route chart']]){
  const read=act(stateAt(location),'read '+target);assert.equal(read.accepted,true);assert.equal(read.state.flags.cityGateAligned,false);
  const aligned=act({...read.state,currentLocation:'city-under-wheel'},'turn marked wheel');assert.equal(aligned.accepted,true);
  assert.match(visibleLocationDescription(roads,aligned.state,'city-under-gate'),/stands open/);
  assert.equal(move({...aligned.state,currentLocation:'city-under-gate'},'city-under-archive').accepted,true);
  assert.equal(move({...aligned.state,currentLocation:'city-under-archive'},'city-under-gate').accepted,true);
 }
});
test('seal survey requires physical collection before report and never completes the campaign',()=>{
 assert.equal(act(stateAt('city-delvers'),'report municipal seal').accepted,false);
 const copied=act(stateAt('city-under-plaza'),'copy municipal seal');assert.equal(copied.accepted,true);
 const reported=act({...copied.state,currentLocation:'city-delvers'},'report municipal seal');assert.equal(reported.accepted,true);
 assert.equal(reported.state.flags.citySealReported,true);assert.equal(reported.state.stage,copied.state.stage);
 assert.ok(!reported.state.flags.maraRescued);
});
test('sentinel remains an optional real encounter, defeated descriptions stay truthful and the citadel has no imaginary exit',()=>{
 const encounter=roads.encounters.find(e=>e.id==='city-ward-sentinel');assert.equal(encounter.enemy.hp,14);assert.equal(encounter.resolvedFlag,'citySentinelResolved');
 assert.ok(roads.locations['city-under-gallery'].exits.some(e=>e.to==='city-under-refuge'));
 assert.match(visibleLocationDescription(roads,stateAt('city-under-ward',{citySentinelResolved:true}),'city-under-ward'),/defeated sentinel does not return/);
 assert.equal(roads.locations['city-under-boundary'].exits.length,1);
});
function fixture(location){const folder=mkdtempSync(join(tmpdir(),'hearthbound-city-')),db=createDatabase(join(folder,'test.sqlite')),party=buildLobby(db).worlds[0].parties[0],player=createPlayer(db,{partyId:party.id,name:'Neil',species:'Human',className:'Fighter'});selectAdventure(db,party.id,party.worldId+'-eldervale-roads');setPartyState(db,party.id,'world:eldervale-roads',stateAt(location));return {db,party,player,close(){db.close();rmSync(folder,{recursive:true,force:true});}};}
test('actual city controls retain regional locality and reject remote destinations through the shared executor',async()=>{
 const f=fixture('city');try{
  let view=regionalAtlasView(f.db,f.player);assert.equal(view.city.sites.length,13);assert.equal(view.local,null);
  await resolveAction(f.db,getPlayer(f.db,f.player.id),'act',regionalTravelCommand(f.db,f.player,'city-delvers'));
  view=regionalAtlasView(f.db,f.player);assert.equal(view.currentSite,'city');assert.equal(view.local.id,'city-delvers');
  assert.throws(()=>regionalTravelCommand(f.db,f.player,'city-scholars-college'),/connected road/);
  await resolveAction(f.db,getPlayer(f.db,f.player.id),'act',regionalTravelCommand(f.db,f.player,'city-delvers-last'));
  await resolveAction(f.db,getPlayer(f.db,f.player.id),'act','read descent safety ledger');
  assert.equal(getPartyState(f.db,f.party.id,'world:eldervale-roads').flags.cityDescentBriefed,true);
  await resolveAction(f.db,getPlayer(f.db,f.player.id),'act','enter Rope Landing');
  view=regionalAtlasView(f.db,f.player);assert.equal(view.currentSite,'city');assert.equal(view.local.id,'city-undercity');
  assert.equal(view.local.sites.length,3);assert.throws(()=>regionalTravelCommand(f.db,f.player,'city-under-archive'),/connected road/);
  assert.equal(view.local.sites.find(s=>s.id==='city-delvers-last').available,true,'the real return stair is available in map controls');
 }finally{f.close();}
});
test('ward combat uses real rolls, blocks city travel, persists victory and cannot respawn',async()=>{
 const f=fixture('city-under-plaza'),random=Math.random;try{Math.random=()=>.5;
  await resolveAction(f.db,getPlayer(f.db,f.player.id),'act','enter Ward Street');
  assert.equal(getPartyState(f.db,f.party.id,'combat').authoredEncounter,'city-ward-sentinel');
  assert.match(regionalAtlasView(f.db,f.player).local.reason,/combat/);
  assert.throws(()=>regionalTravelCommand(f.db,f.player,'city-delvers'),/combat/);
  for(let turn=0;turn<8&&getPartyState(f.db,f.party.id,'combat').active;turn++){
   await resolveAction(f.db,getPlayer(f.db,f.player.id),'act','attack the Old ward sentinel');
   let pending=getPartyState(f.db,f.party.id,'combat').pendingRoll;
   if(pending?.kind==='attack')resolveCombatRoll(f.db,getPlayer(f.db,f.player.id),20,20);
   pending=getPartyState(f.db,f.party.id,'combat').pendingRoll;
   if(pending?.kind==='damage')resolveCombatRoll(f.db,getPlayer(f.db,f.player.id),pending.dieSides,pending.dieSides);
  }
  assert.equal(getPartyState(f.db,f.party.id,'combat').outcome,'victory');
  const state=getPartyState(f.db,f.party.id,'world:eldervale-roads');assert.equal(state.flags.citySentinelResolved,true);assert.equal(state.flags.citySealCopied,false);
  assert.equal(startLocationEncounter(f.db,f.player,roads,state),null);
 }finally{Math.random=random;f.close();}
});
