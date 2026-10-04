import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createDatabase,buildLobby,createPlayer,getPlayer,getActiveAdventure,getPartyState,listInventory,setPartyState,listVisibleEvents} from "../server/database.mjs";
import {changeRegionalJourney,regionalAtlasView,regionalTravelCommand,carriageTravelCommand} from "../server/regional-atlas.mjs";
import {resolveAction} from "../server/dm.mjs";
import {createCanonicalState} from "../server/interaction-engine.mjs";
import {projectNpc,projectScene} from "../server/scene-projection.mjs";
import {resolveCombatRoll,startLocationEncounter} from "../server/combat.mjs";
import {visibleNpcPortraits,visibleNpcProfiles,NPC_PORTRAIT_FILES} from "../shared/portrait-catalogue.mjs";
import {stonecrossNpcs,stonecrossAtlas} from "../server/adventures/stonecross.mjs";
import roads from "../server/adventures/eldervale-roads.mjs";
import {carriageServices} from "../server/adventures/carriage-network.mjs";

function fixture(){
  const folder=mkdtempSync(join(tmpdir(),"hearthbound-stonecross-")),db=createDatabase(join(folder,"test.sqlite"));
  const party=buildLobby(db).worlds[0].parties[0],player=createPlayer(db,{partyId:party.id,name:"Neil",species:"Human",className:"Fighter"});
  changeRegionalJourney(db,player,"explore");
  const act=(text,mode="act")=>resolveAction(db,getPlayer(db,player.id),mode,text);
  const view=()=>regionalAtlasView(db,player),state=()=>getPartyState(db,party.id,"world:eldervale-roads");
  const travel=id=>act(regionalTravelCommand(db,player,id));
  return {db,party,player,act,view,travel,state,close(){db.close();rmSync(folder,{recursive:true,force:true});}};
}
const arrive=async f=>{await f.travel("market");await f.travel("ferry");};

test("Stonecross charts fixed public places, hides the quest site and does not invent residents or shortcuts",async()=>{
  const f=fixture();try{
    await arrive(f);
    const local=f.view().local;
    assert.equal(local.id,"stonecross");assert.equal(local.sites.length,6);
    assert.ok(!local.sites.some(site=>site.id==="stonecross-boathouse"));
    assert.ok(local.sites.filter(site=>site.id!=="ferry").every(site=>!site.visited&&!site.npcs.length));
    assert.equal(f.view().currentSite,"ferry");
    await f.travel("stonecross-hut");
    assert.equal(f.view().currentSite,"ferry");
    assert.throws(()=>regionalTravelCommand(f.db,f.player,"stonecross-inn"),/connected road/);
    assert.throws(()=>regionalTravelCommand(f.db,f.player,"stonecross-boathouse"),/connected road/);
    assert.deepEqual(f.view().local.sites.map(site=>[site.id,site.x,site.y]),local.sites.map(site=>[site.id,site.x,site.y]));
    assert.doesNotMatch(JSON.stringify(f.view().local),/deliveryResolved|orchardRestored|Bessa/);
  }finally{f.close();}
});
test("both independent bell investigations reveal the same site and advice without repairing or moving",async()=>{
  for(const [location,text] of [["stonecross-inn","read river journal"],["stonecross-boatyard","inspect storm-damage report"]]){
    const f=fixture();try{
      await arrive(f);await f.travel(location);await f.act(text);
      assert.equal(f.state().flags.stonecrossBellKnown,true);
      assert.equal(f.state().flags.stonecrossBellEvidence,true);
      assert.equal(f.state().flags.stonecrossBellRestored,false);
      assert.equal(f.state().flags.stonecrossRatsResolved,false);
      assert.equal(f.state().currentLocation,location);
      assert.equal(f.view().local.sites.length,7);
      assert.throws(()=>regionalTravelCommand(f.db,f.player,"stonecross-boathouse"),/connected road/);
      await f.act(text);
      assert.equal(f.state().discoveries.filter(id=>id==="stonecross-bell-advice").length,1);
    }finally{f.close();}
  }
});
test("nonviolent bell task is physical, idempotent and distinct from the ferry and main adventure",async()=>{
  const f=fixture();try{
    const inventory=listInventory(f.db,f.player.id),hp=getPlayer(f.db,f.player.id).hp;
    const paused=structuredClone(getPartyState(f.db,f.party.id,"world:lantern-below"));
    await arrive(f);await f.act("report bell repair","speak");
    assert.equal(f.state().flags.stonecrossBellReported,false);
    await f.travel("stonecross-reeds");await f.act("bait feeding bowl");
    assert.equal(f.state().flags.stonecrossRatsResolved,false,"guessing the bait does not bypass disclosure");
    await f.travel("ferry");await f.travel("stonecross-inn");await f.act("read river journal");
    await f.travel("ferry");await f.travel("stonecross-reeds");
    await f.act("bait feeding bowl","speak");
    assert.equal(f.state().flags.stonecrossRatsResolved,false);
    await f.act("inspect feeding bowl");assert.equal(f.state().flags.stonecrossRatsResolved,false);
    await f.act("lure rats away using the feeding bowl");
    assert.equal(f.state().flags.stonecrossBellApproach,"lured");
    assert.equal(f.state().flags.stonecrossBaitPlaced,true);
    await f.travel("stonecross-boathouse");
    assert.ok(!getPartyState(f.db,f.party.id,"combat")?.active);
    await f.act("inspect warning bell frame");assert.equal(f.state().flags.stonecrossBellRestored,false);
    await f.act("repair warning bell","speak");assert.equal(f.state().flags.stonecrossBellRestored,false);
    await f.act("repair warning bell");assert.equal(f.state().flags.stonecrossBellRestored,true);
    assert.equal(f.state().flags.ferryRepaired,false);
    await f.act("repair warning bell");
    assert.equal(f.state().discoveries.filter(id=>id==="stonecross-bell-restored").length,1);
    await f.travel("stonecross-reeds");await f.act("bait feeding bowl");
    assert.equal(f.state().flags.stonecrossBellApproach,"lured");
    await f.travel("ferry");await f.act("tell Jory about the bell repair","speak");
    assert.equal(f.state().flags.stonecrossBellReported,true);
    await f.travel("stonecross-inn");await f.act("read river journal");
    assert.ok(projectNpc(roads.story.npcs.ferryman,f.state()).facts.some(fact=>/restored the warning bell/.test(fact)));
    assert.ok(!projectNpc(roads.story.npcs.ferryman,f.state()).facts.some(fact=>/bell is damaged/.test(fact)));
    await f.travel("ferry");await f.travel("stonecross-reeds");await f.travel("stonecross-boathouse");
    assert.match(projectScene(roads,f.state()).description,/bell hangs free/);
    assert.equal(startLocationEncounter(f.db,f.player,roads,f.state()),null);
    assert.deepEqual(listInventory(f.db,f.player.id),inventory);assert.equal(getPlayer(f.db,f.player.id).hp,hp);
    assert.equal(getPlayer(f.db,f.player.id).level,1);assert.equal(getActiveAdventure(f.db,f.party.id).status,"active");
    assert.deepEqual(getPartyState(f.db,f.party.id,"world:lantern-below"),paused);
    assert.equal(getPartyState(f.db,f.party.id,"pendingLevelUps"),null);
  }finally{f.close();}
});
test("the optional marsh-rat fight uses real rolls, blocks travel, commits victory once and leaves repair unfinished",async()=>{
  const f=fixture(),random=Math.random;try{
    Math.random=()=>.5;
    await arrive(f);await f.travel("stonecross-boatyard");await f.act("inspect damage report");
    await f.travel("stonecross-reeds");await f.travel("stonecross-boathouse");
    assert.equal(getPartyState(f.db,f.party.id,"combat").authoredEncounter,"stonecross-marsh-rats");
    assert.match(f.view().local.reason,/combat/);
    assert.throws(()=>regionalTravelCommand(f.db,f.player,"stonecross-reeds"),/combat/);
    for(let turn=0;turn<8&&getPartyState(f.db,f.party.id,"combat").active;turn++){
      await f.act("attack the marsh rats");
      let pending=getPartyState(f.db,f.party.id,"combat").pendingRoll;
      if(pending?.kind==="attack")resolveCombatRoll(f.db,getPlayer(f.db,f.player.id),20,20);
      pending=getPartyState(f.db,f.party.id,"combat").pendingRoll;
      if(pending?.kind==="damage")resolveCombatRoll(f.db,getPlayer(f.db,f.player.id),pending.dieSides,pending.dieSides);
    }
    assert.equal(getPartyState(f.db,f.party.id,"combat").outcome,"victory");
    assert.equal(f.state().flags.stonecrossRatsResolved,true);
    assert.equal(f.state().flags.stonecrossBellApproach,"combat");
    assert.equal(f.state().flags.stonecrossBellRestored,false);
    assert.equal(startLocationEncounter(f.db,f.player,roads,f.state()),null);
    await f.act("secure fallen beam");assert.equal(f.state().flags.stonecrossBellRestored,true);
    await f.travel("stonecross-reeds");await f.act("bait feeding bowl");
    assert.equal(f.state().flags.stonecrossBellApproach,"combat");
    await f.travel("stonecross-boathouse");assert.ok(!getPartyState(f.db,f.party.id,"combat").active);
    const victories=listVisibleEvents(f.db,f.player).filter(event=>/pack scatters into/.test(event.text));
    assert.equal(victories.length,1);
  }finally{Math.random=random;f.close();}
});
test("repair advice is required even when a disclosed encounter was bypassed safely",async()=>{
  const f=fixture();try{
    await arrive(f);await f.act("ask Jory about work","speak");
    assert.equal(f.state().flags.stonecrossBellKnown,true);
    assert.equal(f.state().flags.stonecrossBellEvidence,false);
    await f.travel("stonecross-reeds");await f.act("bait feeding bowl");await f.travel("stonecross-boathouse");
    await f.act("free warning bell");assert.equal(f.state().flags.stonecrossBellRestored,false);
    assert.match(listVisibleEvents(f.db,f.player).at(-1).text,/journal|damage report/);
    await f.travel("stonecross-reeds");await f.travel("stonecross-boatyard");await f.act("inspect damage report");
    await f.travel("stonecross-reeds");await f.travel("stonecross-boathouse");await f.act("free warning bell");
    assert.equal(f.state().flags.stonecrossBellRestored,true);
  }finally{f.close();}
});
test("old ferry saves preserve repairs, visits and identity without re-running the new quest",()=>{
  const saved={currentLocation:"ferry",visited:["city","market","ferry"],flags:{ferryRepaired:true},completedInteractions:["repair-ferry"],discoveries:["ferry-restored"]};
  const state=createCanonicalState(roads,saved);
  assert.equal(state.currentLocation,"ferry");assert.deepEqual(state.visited,saved.visited);
  assert.equal(state.flags.ferryRepaired,true);assert.equal(state.flags.stonecrossBellKnown,false);
  assert.equal(state.flags.stonecrossBellRestored,false);assert.equal(roads.story.npcs.ferryman.name,"Jory Pike");
});
test("Stonecross coach journeys preserve every connecting stop and existing crossing gates",async()=>{
  const f=fixture();try{
    await arrive(f);await f.travel("stonecross-coach");
    assert.equal(f.view().carriages.length,4);
    assert.ok(f.view().carriages.every(service=>!service.available&&/mooring/.test(service.reason)));
    assert.throws(()=>carriageTravelCommand(f.db,f.player,"carriage-stonecross-coach-market"),/mooring/);
    await f.travel("ferry");await f.act("repair ferry mooring");await f.travel("stonecross-coach");
    assert.equal(f.state().flags.stonecrossBellRestored,false);
    assert.equal(f.view().carriages.find(service=>service.id==="carriage-stonecross-coach-city").available,true);
    assert.equal(f.view().carriages.find(service=>service.id==="carriage-stonecross-coach-willow-coach").available,false);
    await f.act(carriageTravelCommand(f.db,f.player,"carriage-stonecross-coach-city"));
    assert.equal(f.state().currentLocation,"city");
    const route=carriageServices.find(service=>service.id==="carriage-stonecross-coach-city").journey;
    assert.deepEqual(route,["stonecross-coach","ferry","market","city"]);
    assert.ok(route.every(id=>f.state().visited.includes(id)));
    assert.equal(f.state().previousLocation,"market");
    await f.act(carriageTravelCommand(f.db,f.player,"carriage-city-stonecross-coach"));
    assert.equal(f.state().currentLocation,"stonecross-coach");
    const other=createPlayer(f.db,{partyId:f.party.id,name:"Pat",className:"Fighter",species:"Human"});
    setPartyState(f.db,f.party.id,"pendingCheck:"+other.id,{ability:"Wisdom",dc:10});
    assert.ok(f.view().carriages.every(service=>!service.available));
    assert.throws(()=>carriageTravelCommand(f.db,f.player,"carriage-stonecross-coach-city"),/pending check/);
  }finally{f.close();}
});
test("four Stonecross portraits and public backgrounds are original assets disclosed only on encounter",()=>{
  assert.deepEqual(visibleNpcPortraits(roads,[]),{});assert.deepEqual(visibleNpcProfiles(roads,[]),{});
  for(const npc of Object.values(stonecrossNpcs)){
    const events=[{speaker:npc.name}];
    assert.equal(visibleNpcPortraits(roads,events)[npc.name],npc.portraitId);
    assert.equal(visibleNpcProfiles(roads,events)[npc.name].background,npc.publicBackground);
    assert.doesNotMatch(npc.publicBackground,/bell.*beam|rats|secret|campaign/i);
    assert.equal(readFileSync(new URL("../public"+NPC_PORTRAIT_FILES[npc.portraitId],import.meta.url)).subarray(1,4).toString(),"PNG");
  }
  assert.equal(readFileSync(new URL("../public"+stonecrossAtlas.image,import.meta.url)).subarray(1,4).toString(),"PNG");
});
