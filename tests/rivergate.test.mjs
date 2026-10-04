import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createDatabase,buildLobby,createPlayer,getPlayer,getPartyState,listInventory,setPartyState,listVisibleEvents} from "../server/database.mjs";
import {changeRegionalJourney,regionalAtlasView,regionalTravelCommand,carriageTravelCommand} from "../server/regional-atlas.mjs";
import {resolveAction} from "../server/dm.mjs";
import {projectNpc} from "../server/scene-projection.mjs";
import {createCanonicalState} from "../server/interaction-engine.mjs";
import {visibleNpcPortraits,NPC_PORTRAIT_FILES} from "../shared/portrait-catalogue.mjs";
import {rivergateNpcs,rivergateAtlas} from "../server/adventures/rivergate.mjs";
import roads from "../server/adventures/eldervale-roads.mjs";

function fixture(){
  const folder=mkdtempSync(join(tmpdir(),"hearthbound-rivergate-")),db=createDatabase(join(folder,"test.sqlite"));
  const party=buildLobby(db).worlds[0].parties[0],player=createPlayer(db,{partyId:party.id,name:"Neil",species:"Human",className:"Fighter"});
  changeRegionalJourney(db,player,"explore");
  const act=(text,mode="act")=>resolveAction(db,getPlayer(db,player.id),mode,text);
  const view=()=>regionalAtlasView(db,player);
  const travel=id=>act(regionalTravelCommand(db,player,id));
  const state=()=>getPartyState(db,party.id,"world:eldervale-roads");
  return {db,party,player,act,view,travel,state,close(){db.close();rmSync(folder,{recursive:true,force:true});}};
}
test("Rivergate charts seven fixed public places without visiting residents or permitting remote travel",async()=>{
  const f=fixture();try{
    await f.travel("market");
    const local=f.view().local;
    assert.equal(local.id,"rivergate");
    assert.equal(local.sites.length,7);
    assert.equal(f.view().currentSite,"market");
    assert.ok(local.sites.filter(p=>p.id!=="market").every(p=>!p.visited&&p.npcs.length===0));
    assert.equal(local.routes.length,7);
    assert.equal(new Set(local.sites.map(p=>p.x+":"+p.y)).size,7);
    await f.travel("rivergate-inn");
    assert.equal(f.view().currentSite,"market");
    assert.throws(()=>regionalTravelCommand(f.db,f.player,"rivergate-records"),/connected road/);
    assert.throws(()=>carriageTravelCommand(f.db,f.player,"carriage-market-city"),/available carriage/);
    assert.match(f.view().local.imageAlt,/Rivergate/);
    assert.doesNotMatch(JSON.stringify(f.view().local),/Willowford's water|Bessa|orchard-sluice/);
    await f.travel("market");await f.travel("rivergate-warehouse");await f.travel("rivergate-docks");
    assert.equal(f.state().currentLocation,"rivergate-docks");
    await f.travel("rivergate-warehouse");
    assert.equal(f.state().currentLocation,"rivergate-warehouse");
  }finally{f.close();}
});
test("dock and records sources independently verify the same delivery without moving cargo",async()=>{
  for(const [id,action] of [["rivergate-docks","compare sealed delivery labels"],["rivergate-records","read delivery manifest"]]){
    const f=fixture();try{
      await f.travel("market");await f.travel(id);
      await f.act(action);
      assert.equal(f.state().flags.deliveryEvidence,true);
      assert.equal(f.state().flags.deliveryResolved,false);
      assert.equal(f.state().currentLocation,id);
      assert.ok(f.state().discoveries.includes("rivergate-receiver"));
      const before=structuredClone(f.state());
      await f.act(action);
      assert.deepEqual(f.state().flags,before.flags);
      assert.equal(f.state().discoveries.filter(d=>d==="rivergate-receiver").length,1);
    }finally{f.close();}
  }
});
test("verified delivery correction and report persist on revisit without rewards or overwriting the chosen solution",async()=>{
  const f=fixture();try{
    const inventory=listInventory(f.db,f.player.id),hp=getPlayer(f.db,f.player.id).hp;
    await f.travel("market");await f.act("ask Elin about work","speak");
    assert.equal(f.state().flags.deliveryKnown,true);
    await f.act("report delivery correction","speak");
    assert.equal(f.state().flags.deliveryReported,false);
    await f.travel("rivergate-docks");
    await f.act("arrange delivery correction");
    assert.equal(f.state().flags.deliveryResolved,false);
    await f.act("inspect loading board");
    const before=structuredClone(f.state());
    await f.act("redirect delivery","speak");
    assert.deepEqual(f.state().flags,before.flags,"speech does not physically redirect cargo");
    await f.act("redirect delivery");
    assert.equal(f.state().flags.deliveryResolved,true);
    assert.equal(f.state().flags.deliveryMethod,"verified");
    await f.act("exchange deliveries");
    assert.equal(f.state().flags.deliveryMethod,"verified");
    await f.travel("market");await f.act("report delivery correction","speak");
    assert.equal(f.state().flags.deliveryReported,true);
    await f.travel("city");await f.travel("market");await f.travel("rivergate-docks");
    assert.match(f.view().local.sites.find(p=>p.current).description,/corrected/);
    assert.ok(projectNpc(roads.story.npcs.courier,f.state()).facts.some(fact=>/delivery is corrected/i.test(fact)));
    assert.ok(!projectNpc(roads.story.npcs.courier,f.state()).facts.some(fact=>/has been misdirected/.test(fact)));
    assert.deepEqual(listInventory(f.db,f.player.id),inventory);
    assert.equal(getPlayer(f.db,f.player.id).hp,hp);
    assert.equal(getPlayer(f.db,f.player.id).level,1);
    assert.ok(!f.state().completed);
  }finally{f.close();}
});
test("authorised exchange is an independent solution; asking permission neither moves nor resolves cargo",async()=>{
  const f=fixture();try{
    await f.travel("market");await f.travel("rivergate-warehouse");
    await f.act("ask for exchange permission","speak");
    assert.equal(f.state().flags.deliveryExchangePermission,false);
    await f.travel("market");await f.act("ask about delivery","speak");
    await f.travel("rivergate-warehouse");await f.act("request exchange permission","speak");
    assert.equal(f.state().flags.deliveryExchangePermission,true);
    assert.equal(f.state().flags.deliveryEvidence,false);
    assert.equal(f.state().flags.deliveryResolved,false);
    assert.equal(f.state().currentLocation,"rivergate-warehouse");
    await f.travel("rivergate-docks");await f.act("swap sealed deliveries");
    assert.equal(f.state().flags.deliveryMethod,"exchange");
    await f.act("redirect delivery");
    assert.equal(f.state().flags.deliveryMethod,"exchange");
    await f.travel("market");await f.act("tell Elin the delivery news","speak");
    assert.equal(f.state().flags.deliveryReported,true);
  }finally{f.close();}
});
test("existing market save keeps state, old courier identity and visits when Rivergate is added",()=>{
  const saved={currentLocation:"market",previousLocation:"city",visited:["city","market"],flags:{ferryRepaired:true,orchardMethod:"cleared",orchardRestored:true},completedInteractions:["repair-ferry"],discoveries:["ferry-restored"]};
  const state=createCanonicalState(roads,saved);
  assert.equal(state.currentLocation,"market");
  assert.deepEqual(state.visited,saved.visited);
  assert.equal(state.flags.ferryRepaired,true);
  assert.equal(state.flags.orchardMethod,"cleared");
  assert.equal(state.flags.deliveryKnown,false);
  assert.equal(roads.story.npcs.courier.name,"Elin Marr");
  assert.equal(roads.story.npcs.courier.locations[0],"market");
});
test("Rivergate atlas, actions and story directions remain local and block all-party hazards",async()=>{
  const f=fixture();try{
    await f.travel("market");
    assert.ok(f.view().local.actions.some(a=>a.id==="rivergate-delivery-invitation"));
    assert.ok(!f.view().local.actions.some(a=>/redirect|exchange/.test(a.id)));
    const second=createPlayer(f.db,{partyId:f.party.id,name:"Pat",species:"Human",className:"Fighter"});
    setPartyState(f.db,f.party.id,"pendingCheck:"+second.id,{ability:"Wisdom",dc:10});
    assert.ok(f.view().local.sites.every(p=>!p.available));
    assert.match(f.view().local.reason,/pending check/);
    assert.throws(()=>regionalTravelCommand(f.db,f.player,"rivergate-inn"),/pending check/);
    assert.ok(!f.view().sites.some(s=>s.id==="briarwatch"),"rumours do not reveal a chapter marker");
  }finally{f.close();}
});
test("six reviewed Rivergate portraits and map assets are stable and only disclosed after visible events",()=>{
  assert.deepEqual(visibleNpcPortraits(roads,[]),{});
  for(const npc of Object.values(rivergateNpcs)){
    assert.equal(visibleNpcPortraits(roads,[{speaker:npc.name}])[npc.name],npc.portraitId);
    const path=NPC_PORTRAIT_FILES[npc.portraitId];
    assert.ok(path);
    assert.equal(readFileSync(new URL("../public"+path,import.meta.url)).subarray(1,4).toString(),"PNG");
  }
  assert.equal(readFileSync(new URL("../public"+rivergateAtlas.image,import.meta.url)).subarray(1,4).toString(),"PNG");
  const source=readFileSync(new URL("../src/LocalAtlas.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(source,/Illustrated Willowford|Village atlas|orchardReported/);
});
test("Rivergate coach stand boards real services and preserves every connecting stop and crossing gate",async()=>{
  const f=fixture();try{
    await f.travel("market");await f.travel("rivergate-coach");
    assert.equal(f.view().carriages.length,3);
    const city=f.view().carriages.find(service=>service.id==="carriage-rivergate-coach-city");
    assert.equal(city.available,true);
    assert.equal(f.view().carriages.find(service=>service.id==="carriage-rivergate-coach-willow-coach").available,false);
    await f.act(carriageTravelCommand(f.db,f.player,city.id));
    assert.equal(f.state().currentLocation,"city");
    assert.ok(f.state().visited.includes("market"));
    assert.ok(f.state().visited.includes("rivergate-coach"));
    await f.act(carriageTravelCommand(f.db,f.player,"carriage-city-rivergate-coach"));
    assert.equal(f.state().currentLocation,"rivergate-coach");
    setPartyState(f.db,f.party.id,"combat",{active:true});
    assert.ok(f.view().carriages.every(service=>!service.available));
    assert.throws(()=>carriageTravelCommand(f.db,f.player,city.id),/combat/);
  }finally{f.close();}
});
