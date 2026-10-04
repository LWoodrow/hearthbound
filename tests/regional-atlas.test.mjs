import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createDatabase,buildLobby,createPlayer,getPartyState,setPartyState,getPlayer,getActiveAdventure,listVisibleEvents,listInventory,getKnownLocations,selectAdventure} from "../server/database.mjs";
import {regionalAtlasView,changeRegionalJourney,regionalTravelCommand,carriageTravelCommand} from "../server/regional-atlas.mjs";
import {resolveAction} from "../server/dm.mjs";
import {createCanonicalState,canonicalProjection} from "../server/interaction-engine.mjs";
import lantern from "../server/adventures/lantern-below.mjs";
import roads from "../server/adventures/eldervale-roads.mjs";
import {projectScene,projectNpc} from "../server/scene-projection.mjs";
import {authoredRouteContext} from "../server/adventure-rules.mjs";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {createServer} from "node:http";
import {fileURLToPath} from "node:url";
import {loginPlayer} from "../server/database.mjs";

function fixture(){
  const folder=mkdtempSync(join(tmpdir(),"hearthbound-atlas-"));
  const db=createDatabase(join(folder,"test.sqlite"));
  const party=buildLobby(db).worlds[0].parties[0];
  const player=createPlayer(db,{partyId:party.id,name:"Neil",species:"Human",className:"Fighter"});
  const view=()=>regionalAtlasView(db,getPlayer(db,player.id));
  const act=text=>resolveAction(db,getPlayer(db,player.id),"act",text);
  const travel=id=>act(regionalTravelCommand(db,player,id));
  return {db,party,player,view,act,travel,close(){db.close();rmSync(folder,{recursive:true,force:true});}};
}

test("regional chart exposes public geography without future chapters or unvisited NPC identities",()=>{
  const f=fixture();try{
    assert.equal(f.view().sites.length,7);
    assert.equal(f.view().currentSite,"city");
    assert.equal(f.view().canExplore,true);
    assert.ok(!f.view().sites.some(site=>["briarwatch","court"].includes(site.id)));
    assert.deepEqual(f.view().sites.find(site=>site.id==="ferry").npcs,[]);
    assert.throws(()=>regionalTravelCommand(f.db,f.player,"ferry"),/connected road/);
    assert.ok(f.view().routes.every(route=>!route.travelled));
  }finally{f.close();}
});

test("detours preserve exact main-story state, character resources and completed status",async()=>{
  const f=fixture();try{
    const before=createCanonicalState(lantern,{currentLocation:"inn",visited:["outside-inn","inn"],flags:{maraRescued:true,maraSafeAtInn:true,guardianDefeated:true}});
    setPartyState(f.db,f.party.id,"world:lantern-below",before);
    setPartyState(f.db,f.party.id,"dm",canonicalProjection(lantern,before));
    f.db.prepare("UPDATE party_adventures SET status='complete' WHERE party_id=?").run(f.party.id);
    const inventory=listInventory(f.db,f.player.id);
    const player=getPlayer(f.db,f.player.id);
    changeRegionalJourney(f.db,f.player,"explore");
    assert.equal(getPartyState(f.db,f.party.id,"dm").currentLocationKey,"city","opening position is canonical before the first turn");
    assert.match(getActiveAdventure(f.db,f.party.id).id,/eldervale-roads$/);
    await f.travel("market");
    assert.equal(f.view().currentSite,"market");
    assert.ok(listVisibleEvents(f.db,f.player).some(event=>event.speaker==="Elin Marr"));
    assert.throws(()=>changeRegionalJourney(f.db,f.player,"return"),/not available/);
    await f.travel("city");
    changeRegionalJourney(f.db,f.player,"return");
    assert.equal(getActiveAdventure(f.db,f.party.id).status,"complete");
    assert.deepEqual(getPartyState(f.db,f.party.id,"world:lantern-below"),before);
    assert.equal(getPartyState(f.db,f.party.id,"dm").currentLocationKey,"inn");
    assert.equal(getPlayer(f.db,f.player.id).hp,player.hp);
    assert.deepEqual(listInventory(f.db,f.player.id),inventory);
    assert.equal(getPartyState(f.db,f.party.id,"regionalReturn"),null);
  }finally{f.close();}
});

test("regional routes use canonical movement, preserve optional activities and project current NPC facts",async()=>{
  const f=fixture();try{
    changeRegionalJourney(f.db,f.player,"explore");
    assert.throws(()=>regionalTravelCommand(f.db,f.player,"wood"),/connected road/);
    await f.travel("market");
    await f.travel("ferry");
    await f.act("repair ferry mooring");
    let world=getPartyState(f.db,f.party.id,"world:eldervale-roads");
    assert.equal(world.flags.ferryRepaired,true);
    assert.match(projectScene(roads,world).description,/back in service/);
    assert.ok(projectNpc(roads.story.npcs.ferryman,world).facts.every(fact=>!/frayed|needs someone/.test(fact)));
    const inventory=listInventory(f.db,f.player.id);
    await f.act("repair ferry mooring");
    assert.deepEqual(listInventory(f.db,f.player.id),inventory);
    await f.travel("village");await f.travel("wood");await f.travel("hill");await f.travel("abbey");
    await f.act("share a story with Iona");
    assert.equal(f.view().activities.storyRecorded,true);
    await f.travel("city");
    const visited=getPartyState(f.db,f.party.id,"world:eldervale-roads").visited;
    assert.equal(new Set(visited).size,7);
    assert.equal(f.view().routes.find(route=>route.from==="city"&&route.to==="hill").travelled,false,"visiting both ends is not traversing the road");
    const context=authoredRouteContext(getActiveAdventure(f.db,f.party.id).id,getPartyState(f.db,f.party.id,"dm"),getPartyState(f.db,f.party.id,"world:eldervale-roads"));
    assert.equal(context.currentLocation.key,"city","backtracking does not follow the last added map entry");
    assert.equal(getKnownLocations(f.db,f.party.id).length,7);
    changeRegionalJourney(f.db,f.player,"return");
    changeRegionalJourney(f.db,f.player,"explore");
    assert.equal(f.view().activities.ferryRepaired,true);
    assert.equal(f.view().activities.storyRecorded,true);
    assert.equal(getPlayer(f.db,f.player.id).level,1,"optional stops do not award campaign levels");
  }finally{f.close();}
});

test("regional departure is blocked by dungeon locality, combat, another player's check and fallen party members",()=>{
  const f=fixture();try{
    const world=createCanonicalState(lantern,{currentLocation:"cellar"});
    setPartyState(f.db,f.party.id,"world:lantern-below",world);
    assert.equal(f.view().canExplore,false);
    assert.throws(()=>changeRegionalJourney(f.db,f.player,"explore"),/taproom/);
    setPartyState(f.db,f.party.id,"world:lantern-below",createCanonicalState(lantern,{currentLocation:"outside-inn"}));
    setPartyState(f.db,f.party.id,"combat",{active:true});
    assert.throws(()=>changeRegionalJourney(f.db,f.player,"explore"),/combat/);
    setPartyState(f.db,f.party.id,"combat",null);
    const second=createPlayer(f.db,{partyId:f.party.id,name:"Other",species:"Human",className:"Fighter"});
    setPartyState(f.db,f.party.id,"pendingCheck:"+second.id,{dc:10});
    assert.throws(()=>changeRegionalJourney(f.db,f.player,"explore"),/pending check/);
    setPartyState(f.db,f.party.id,"pendingCheck:"+second.id,null);
    f.db.prepare("UPDATE players SET hp=0 WHERE id=?").run(second.id);
    assert.throws(()=>changeRegionalJourney(f.db,f.player,"explore"),/fallen/);
  }finally{f.close();}
});

test("Briarwatch stage-only approach save can detour and resume exact chapter state without using archived Lantern locality",async()=>{
  const f=fixture();try {
    const lanternState=createCanonicalState(lantern,{currentLocation:"cellar",visited:["outside-inn","inn","cellar"]});
    setPartyState(f.db,f.party.id,"world:lantern-below",lanternState);
    selectAdventure(f.db,f.party.id,f.party.worldId+"-ashes-briarwatch");
    const dm={...getPartyState(f.db,f.party.id,"dm"),clueStage:1,dangerClock:2,customNote:"Unfinished interview"};
    setPartyState(f.db,f.party.id,"dm",dm);
    const inventory=listInventory(f.db,f.player.id),hp=getPlayer(f.db,f.player.id).hp;
    assert.equal(f.view().canExplore,true,"legacy stage-only save is on Road Beyond the Barrier");
    assert.equal(f.view().reason,"");
    assert.match(f.view().departureDescription,/Briarwatch/);
    changeRegionalJourney(f.db,f.player,"explore");
    assert.match(f.view().mainAdventure,/Briarwatch/);
    await f.travel("market");await f.travel("city");
    changeRegionalJourney(f.db,f.player,"return");
    assert.match(getActiveAdventure(f.db,f.party.id).id,/ashes-briarwatch$/);
    assert.deepEqual(getPartyState(f.db,f.party.id,"dm"),dm);
    assert.deepEqual(getPartyState(f.db,f.party.id,"world:lantern-below"),lanternState);
    assert.deepEqual(listInventory(f.db,f.player.id),inventory);
    assert.equal(getPlayer(f.db,f.player.id).hp,hp);
  }finally{f.close();}
});

test("Briarwatch gateways fail closed in dangerous or unknown scenes and retain all-party guards",()=>{
  const f=fixture();try {
    setPartyState(f.db,f.party.id,"world:lantern-below",createCanonicalState(lantern,{currentLocation:"inn"}));
    selectAdventure(f.db,f.party.id,f.party.worldId+"-ashes-briarwatch");
    const base=getPartyState(f.db,f.party.id,"dm");
    for(const [key,stage] of [["briarwatch-road",0],["road-beyond-barrier",1],["east-well",2]]) {
      setPartyState(f.db,f.party.id,"dm",{...base,currentLocationKey:key,clueStage:stage});
      assert.equal(f.view().canExplore,true,key);
    }
    for(const [key,stage] of [["watchtower",4],["signal-room",5],["cinder-vault",6],["unknown-scene",0],["east-well",0]]) {
      setPartyState(f.db,f.party.id,"dm",{...base,currentLocationKey:key,clueStage:stage});
      assert.equal(f.view().canExplore,false,key);
      assert.match(f.view().reason,/Briarwatch/);
      assert.doesNotMatch(f.view().reason,/Crooked Lantern/);
      assert.throws(()=>changeRegionalJourney(f.db,f.player,"explore"),/Briarwatch/);
    }
    setPartyState(f.db,f.party.id,"dm",{...base,clueStage:5});
    assert.equal(f.view().canExplore,false,"legacy signal-room inference must not become an escape hatch");
    setPartyState(f.db,f.party.id,"dm",{...base,clueStage:1});
    const second=createPlayer(f.db,{partyId:f.party.id,name:"Other",species:"Human",className:"Fighter"});
    setPartyState(f.db,f.party.id,"pendingCheck:"+second.id,{dc:12});
    assert.throws(()=>changeRegionalJourney(f.db,f.player,"explore"),/pending check/);
    setPartyState(f.db,f.party.id,"pendingCheck:"+second.id,null);
    setPartyState(f.db,f.party.id,"combat",{active:true});
    assert.throws(()=>changeRegionalJourney(f.db,f.player,"explore"),/combat/);
    setPartyState(f.db,f.party.id,"combat",null);
    f.db.prepare("UPDATE players SET hp=0 WHERE id=?").run(second.id);
    assert.throws(()=>changeRegionalJourney(f.db,f.player,"explore"),/fallen/);
  }finally{f.close();}
});

test("unsupported chapter gives its own blocker and completed Briarwatch survives a detour",()=>{
  const f=fixture();try {
    selectAdventure(f.db,f.party.id,f.party.worldId+"-hollow-star");
    assert.equal(f.view().canExplore,false);
    assert.match(f.view().reason,/this chapter/);
    assert.doesNotMatch(f.view().reason,/Crooked Lantern/);
    selectAdventure(f.db,f.party.id,f.party.worldId+"-ashes-briarwatch");
    setPartyState(f.db,f.party.id,"dm",{...getPartyState(f.db,f.party.id,"dm"),currentLocationKey:"east-well",clueStage:2});
    f.db.prepare("UPDATE party_adventures SET status='complete' WHERE party_id=? AND adventure_id=?").run(f.party.id,f.party.worldId+"-ashes-briarwatch");
    changeRegionalJourney(f.db,f.player,"explore");changeRegionalJourney(f.db,f.player,"return");
    assert.equal(getActiveAdventure(f.db,f.party.id).status,"complete");
  }finally{f.close();}
});

async function arriveWillowford(f) {
  changeRegionalJourney(f.db,f.player,"explore");
  await f.travel("market");await f.travel("ferry");await f.act("repair ferry mooring");await f.travel("village");
}
const regionState=f=>getPartyState(f.db,f.party.id,"world:eldervale-roads");

test("Willowford reveals a fixed local plate with real adjacent places and no premature quest or NPC disclosure",async()=>{
  const f=fixture();try {
    assert.equal(f.view().local,null);
    await arriveWillowford(f);
    assert.equal(f.view().local.sites.length,7);
    assert.ok(f.view().local.sites.filter(site=>site.id!=="village").every(site=>site.available));
    assert.ok(f.view().local.sites.every(site=>site.npcs.length===0));
    assert.throws(()=>regionalTravelCommand(f.db,f.player,"willow-sluice"),/connected road/);
    await f.travel("willow-inn");
    assert.equal(f.view().currentSite,"village","local subplaces retain their regional parent");
    assert.equal(f.view().local.sites.find(site=>site.id==="willow-inn").current,true);
    assert.deepEqual(f.view().local.sites.find(site=>site.id==="willow-inn").npcs,["Merrin Holt"]);
    assert.throws(()=>regionalTravelCommand(f.db,f.player,"wood"),/connected road/);
    assert.throws(()=>regionalTravelCommand(f.db,f.player,"willow-smithy"),/connected road/);
    await f.travel("village");await f.travel("willow-smithy");await f.travel("village");
    await f.travel("willow-shrine");await f.travel("village");await f.travel("willow-landing");
    await f.act("investigate feeder channel");
    assert.equal(regionState(f).flags.sluiceKnown,true,"second independent source reveals the same route");
    assert.equal(f.view().local.sites.length,8);
    assert.equal(f.view().local.sites.find(site=>site.id==="willow-sluice").available,false,"discovery is not teleportation");
    await f.travel("village");await f.travel("willow-orchard");await f.travel("willow-sluice");
    assert.match(projectScene(roads,regionState(f)).description,/grate/);
  }finally{f.close();}
});

test("Willowford's manual repair branch is persistent, local and idempotent without campaign rewards",async()=>{
  const f=fixture();try {
    const main=getPartyState(f.db,f.party.id,"world:lantern-below");
    const inventory=listInventory(f.db,f.player.id);
    await arriveWillowford(f);await f.travel("willow-orchard");
    await f.act("examine irrigation channel");
    assert.equal(regionState(f).flags.sluiceKnown,true);
    await f.travel("willow-sluice");
    await f.act("clear debris");
    assert.equal(regionState(f).flags.orchardRestored,false,"diagnosis is required");
    await f.act("inspect sluice grate");
    assert.equal(regionState(f).flags.blockageKnown,true);
    await f.act("clear debris");
    assert.equal(regionState(f).flags.orchardRestored,true);
    assert.equal(regionState(f).flags.orchardMethod,"cleared");
    await f.act("clear debris");await f.act("open overflow lever");
    assert.equal(regionState(f).flags.orchardMethod,"cleared","a completed repair cannot be silently overwritten by the other branch");
    await f.travel("willow-orchard");
    assert.match(projectScene(roads,regionState(f)).description,/again/);
    assert.ok(projectNpc(roads.story.npcs.orchard,regionState(f)).facts.every(fact=>!/nearly dry/.test(fact)));
    await resolveAction(f.db,f.player,"speak","tell Bessa the water is restored");
    assert.equal(regionState(f).flags.orchardReported,true);
    assert.match(f.view().local.task,/complete/);
    assert.deepEqual(listInventory(f.db,f.player.id),inventory);
    assert.equal(getPlayer(f.db,f.player.id).level,1);
    assert.deepEqual(getPartyState(f.db,f.party.id,"world:lantern-below"),main);
    await f.travel("village");await f.travel("ferry");await f.travel("market");await f.travel("city");
    changeRegionalJourney(f.db,f.player,"return");changeRegionalJourney(f.db,f.player,"explore");
    assert.equal(regionState(f).flags.orchardReported,true);
  }finally{f.close();}
});

test("Willowford's diversion branch needs actual permission and projects a distinct consequence",async()=>{
  const f=fixture();try {
    await arriveWillowford(f);await f.travel("willow-orchard");await f.act("trace water");
    await f.travel("willow-sluice");await f.act("examine blockage");await f.act("pull overflow lever");
    assert.equal(regionState(f).flags.orchardRestored,false);
    await f.travel("willow-orchard");await f.travel("village");await f.travel("willow-shrine");
    await resolveAction(f.db,f.player,"speak","ask permission to use the overflow");
    assert.equal(regionState(f).flags.bypassPermission,true);
    await f.travel("village");await f.travel("willow-orchard");await f.travel("willow-sluice");
    await f.act("turn overflow lever");
    assert.equal(regionState(f).flags.orchardMethod,"bypass");
    assert.equal(regionState(f).flags.orchardRestored,true);
    await f.travel("willow-orchard");await f.act("report repair to Bessa");
    assert.equal(regionState(f).flags.orchardReported,true);
    assert.ok(projectNpc(roads.story.npcs.orchard,regionState(f)).facts.some(fact=>/permission/.test(fact)));
  }finally{f.close();}
});

test("carriages validate known adjacent paths, repaired crossing, current stop and whole-party travel guards",async()=>{
  const f=fixture();try {
    changeRegionalJourney(f.db,f.player,"explore");
    assert.throws(()=>carriageTravelCommand(f.db,f.player,"carriage-city-willow-coach"),/mooring/);
    assert.throws(()=>carriageTravelCommand(f.db,f.player,"carriage-city-market"),/visit/);
    await f.travel("market");await f.travel("ferry");await f.travel("village");await f.travel("willow-coach");
    assert.throws(()=>carriageTravelCommand(f.db,f.player,"carriage-willow-coach-city"),/mooring/);
    await f.act("ride carriage to Eldervale City");
    assert.equal(regionState(f).currentLocation,"willow-coach");
    await f.travel("village");await f.travel("ferry");await f.act("repair mooring");
    await f.travel("village");await f.travel("willow-coach");
    const second=createPlayer(f.db,{partyId:f.party.id,name:"Other",species:"Human",className:"Fighter"});
    setPartyState(f.db,f.party.id,"pendingCheck:"+second.id,{dc:10});
    assert.throws(()=>carriageTravelCommand(f.db,f.player,"carriage-willow-coach-city"),/pending check/);
    setPartyState(f.db,f.party.id,"pendingCheck:"+second.id,null);
    setPartyState(f.db,f.party.id,"combat",{active:true});
    assert.throws(()=>carriageTravelCommand(f.db,f.player,"carriage-willow-coach-city"),/combat/);
    setPartyState(f.db,f.party.id,"combat",null);
    f.db.prepare("UPDATE players SET hp=0 WHERE id=?").run(second.id);
    assert.throws(()=>carriageTravelCommand(f.db,f.player,"carriage-willow-coach-city"),/fallen/);
    f.db.prepare("UPDATE players SET hp=max_hp WHERE id=?").run(second.id);
    await f.act(carriageTravelCommand(f.db,f.player,"carriage-willow-coach-city"));
    assert.equal(regionState(f).currentLocation,"city");
    assert.equal(f.view().canReturn,true);
    assert.throws(()=>carriageTravelCommand(f.db,f.player,"carriage-willow-coach-city"),/current stop/);
    await f.act(carriageTravelCommand(f.db,f.player,"carriage-city-willow-coach"));
    assert.equal(regionState(f).currentLocation,"willow-coach");
    assert.equal(f.view().currentSite,"village");
  }finally{f.close();}
});

test("existing regional saves gain local defaults without losing visited places or activities",()=>{
  const saved={currentLocation:"village",visited:["city","market","ferry","village"],flags:{ferryRepaired:true,storyRecorded:true},revision:8};
  const migrated=createCanonicalState(roads,saved);
  assert.deepEqual(migrated.visited,saved.visited);
  assert.equal(migrated.flags.ferryRepaired,true);
  assert.equal(migrated.flags.storyRecorded,true);
  assert.equal(migrated.flags.sluiceKnown,false);
  assert.equal(migrated.currentLocation,"village");
  assert.equal(migrated.revision,8);
});

test("compact and conversational movement variants share real local exits without permitting remote movement or speech movement",async()=>{
  const f=fixture();try {
    await arriveWillowford(f);
    for(const command of ["goto village square","go to village square","head back to village square","travel to village square","return to village square"]) {
      await f.travel("willow-inn");
      await f.act(command);
      assert.equal(regionState(f).currentLocation,"village",command);
    }
    await f.travel("willow-inn");
    await f.act("goto Orchard Sluice");
    assert.equal(regionState(f).currentLocation,"willow-inn","normalization cannot invent a hidden exit");
    await f.act("goto Hearthforge Smithy");
    assert.equal(regionState(f).currentLocation,"willow-inn","normalization does not bypass the square");
    await resolveAction(f.db,f.player,"speak","goto village square");
    assert.equal(regionState(f).currentLocation,"willow-inn","Say aloud never becomes physical movement");
    await f.act("look towards village square");
    assert.equal(regionState(f).currentLocation,"willow-inn","observation is still observation");
  }finally{f.close();}
});

test("residents know an authored public directory without revealing quest state or making remote people present",async()=>{
  const f=fixture();try {
    await arriveWillowford(f);await f.travel("willow-inn");
    const state=regionState(f),scene=projectScene(roads,state);
    const facts=projectNpc(roads.story.npcs["willow-host"],state).facts;
    assert.ok(facts.some(fact=>/Ada Flint.*Hearthforge Smithy/.test(fact)));
    assert.ok(facts.some(fact=>/Sister Fen.*Wayside Shrine/.test(fact)));
    assert.ok(facts.some(fact=>/not a claim.*current whereabouts/.test(fact)));
    assert.ok(!facts.some(fact=>/storm branches|overflow lever|guardian|Witness/i.test(fact)));
    assert.ok(!scene.visibleFeatures.some(feature=>feature.label==="Ada Flint"));
    assert.equal(state.flags.sluiceKnown,false);
    assert.deepEqual(f.view().local.sites.find(site=>site.id==="willow-smithy").npcs,[],"directory knowledge is not a visit");
  }finally{f.close();}
});

test("nearby-people questions and square greetings project authored life without inventing NPCs or changing state",async()=>{
  const f=fixture();try {
    await arriveWillowford(f);
    const before=regionState(f);
    for(const text of ["any people around here in the square","anyone nearby","are there people here","people around here?"]) {
      const result=await f.act(text);
      assert.match(result.narration,/villagers|farm workers/i,text);
      assert.deepEqual(regionState(f),before,"observation is state-neutral");
    }
    const reply=await resolveAction(f.db,f.player,"speak","hello");
    assert.match(reply.narration,/villager.*hello/i);
    assert.doesNotMatch(reply.narration,/Use Act|Bessa|Ada|permission|sluice/i);
    assert.deepEqual(regionState(f),before);
    assert.ok(!f.view().local.sites.some(site=>site.id==="willow-sluice"));
    assert.equal(Object.keys(roads.story.npcs).length,16,"anonymous people do not create named identities");
  }finally{f.close();}
});

test("world artwork is project-local and atlas controls remain separate accessible overlays",()=>{
  const image=readFileSync(new URL("../public/art/maps/eldervale-atlas-v1.png",import.meta.url));
  assert.equal(image.subarray(1,4).toString(),"PNG");
  const source=readFileSync(new URL("../src/WorldAtlas.tsx",import.meta.url),"utf8");
  assert.match(source,/aria-pressed/);
  assert.match(source,/Choose a destination/);
  assert.match(source,/illustrated-atlas-roads/);
  assert.match(source,/Math.min\(3/);
  assert.match(source,/aria-describedby="regional-departure-help"/);
  assert.match(source,/atlas.reason\|\|atlas.departureDescription/,"disabled departure control has a nearby chapter-specific explanation");
  assert.doesNotMatch(source,/campaign.includes/);
  const css=readFileSync(new URL("../src/styles.css",import.meta.url),"utf8");
  assert.match(css,/\.world-atlas \.atlas-destination \{[^}]*transform:translate\(-15px,-50%\)/,"road coordinates anchor the marker circle, not the variable-width label");
  assert.match(css,/\.atlas-destination>span \{[^}]*flex:0 0 30px/);
});

test("local artwork and authored overlays remain separate and village controls are accessible",async()=>{
  const image=readFileSync(new URL("../public/art/maps/willowford-local-v1.png",import.meta.url));
  assert.equal(image.subarray(1,4).toString(),"PNG");
  const source=readFileSync(new URL("../src/LocalAtlas.tsx",import.meta.url),"utf8");
  assert.match(source,/aria-pressed/);
  assert.match(source,/Choose a local place/);
  assert.match(source,/aria-label="Local map zoom"/);
  assert.match(source,/disabled={busy\|\|!site.available}/);
  assert.doesNotMatch(source,/willow-sluice/,"no hidden quest marker hard-coded in the client");
  // JSX rendering is verified by the build; also verify server projections used
  // by these controls contain no hidden coordinates before discovery.
  const f=fixture();try {
    await arriveWillowford(f);
    assert.ok(!JSON.stringify(f.view().local).includes("willow-sluice"));
    assert.equal(new Set(f.view().local.sites.map(site=>site.x+":"+site.y)).size,7);
    assert.ok(f.view().local.routes.every(route=>f.view().local.sites.some(site=>site.id===route.from)&&f.view().local.sites.some(site=>site.id===route.to)));
  }finally{f.close();}
});

test("regional HTTP controls authenticate, reject forged travel and resume the same saved adventure",async()=>{
  const folder=mkdtempSync(join(tmpdir(),"hearthbound-atlas-http-"));
  const filename=join(folder,"test.sqlite");
  const db=createDatabase(filename);
  const party=buildLobby(db).worlds[0].parties[0];
  const player=createPlayer(db,{partyId:party.id,name:"Neil",species:"Human",className:"Fighter"});
  const session=loginPlayer(db,player.id);
  db.close();
  const reservation=createServer();reservation.listen(0,"127.0.0.1");await once(reservation,"listening");
  const port=reservation.address().port;await new Promise(done=>reservation.close(done));
  const base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,["server/index.mjs"],{cwd:fileURLToPath(new URL("../",import.meta.url)),windowsHide:true,stdio:"ignore",env:{...process.env,PORT:String(port),HOST:"127.0.0.1",DND_DATABASE:filename,AI_SETTINGS_FILE:join(folder,"ai.json"),AI_PROVIDER:"llamacpp",AI_BASE_URL:"http://127.0.0.1:1",AI_MODEL:"test",AI_AUTO_START:"false",HTTPS_KEY:"",HTTPS_CERT:""}});
  const headers={Authorization:`Bearer ${session.token}`,"Content-Type":"application/json"};
  const post=(path,body)=>fetch(base+path,{method:"POST",headers,body:JSON.stringify(body)});
  const game=async()=>(await fetch(base+"/api/game",{headers})).json();
  try{
    let ready=false;
    for(let i=0;i<60;i++){try{ready=(await fetch(base+"/api/lobby")).ok;}catch{}if(ready)break;await new Promise(done=>setTimeout(done,100));}
    assert.equal(ready,true);
    assert.equal((await fetch(base+"/api/region/journey",{method:"POST"})).status,401);
    assert.equal((await fetch(base+"/api/region/travel",{method:"POST"})).status,401);
    assert.equal((await fetch(base+"/api/region/carriage",{method:"POST"})).status,401);
    assert.equal((await post("/api/region/journey",{kind:"forged"})).status,409);
    assert.equal((await post("/api/region/journey",{kind:"explore"})).status,200);
    assert.equal((await game()).recap.currentLocation,"Eldervale City");
    assert.equal((await post("/api/region/travel",{destinationId:"village"})).status,409);
    assert.equal((await post("/api/region/travel",{destinationId:"market"})).status,200);
    const arrived=await game();
    assert.equal(arrived.regionalAtlas.currentSite,"market");
    assert.equal(arrived.recap.currentLocation,"Rivergate Market");
    assert.ok(arrived.events.some(event=>event.speaker==="Elin Marr"));
    assert.equal((await post("/api/region/journey",{kind:"return"})).status,409);
    assert.equal((await post("/api/region/carriage",{serviceId:"carriage-willow-coach-city"})).status,409);
    assert.equal((await post("/api/region/travel",{destinationId:"ferry"})).status,200);
    assert.equal((await post("/api/action",{mode:"act",text:"repair ferry mooring"})).status,200);
    assert.equal((await post("/api/region/travel",{destinationId:"village"})).status,200);
    assert.equal((await game()).regionalAtlas.local.sites.length,7);
    assert.equal((await post("/api/region/travel",{destinationId:"willow-sluice"})).status,409);
    assert.equal((await post("/api/region/travel",{destinationId:"willow-coach"})).status,200);
    assert.equal((await post("/api/region/carriage",{serviceId:"carriage-willow-coach-city"})).status,200);
    assert.equal((await game()).recap.currentLocation,"Eldervale City");
    assert.equal((await post("/api/region/journey",{kind:"return"})).status,200);
    assert.equal((await game()).campaign.title,"The Lantern Below");
    assert.equal((await game()).recap.currentLocation,"Outside the Crooked Lantern");
    assert.equal((await post("/api/adventures/select",{partyId:party.id,adventureId:party.worldId+"-ashes-briarwatch"})).status,200);
    const briarBefore=await game();
    assert.equal(briarBefore.regionalAtlas.canExplore,true);
    assert.equal((await post("/api/region/journey",{kind:"explore"})).status,200);
    assert.match((await game()).regionalAtlas.mainAdventure,/Briarwatch/);
    assert.equal((await post("/api/region/journey",{kind:"return"})).status,200);
    const briarAfter=await game();
    assert.equal(briarAfter.campaign.title,"Ashes of Briarwatch");
    assert.equal(briarAfter.recap.currentLocation,briarBefore.recap.currentLocation);
  }finally{
    if(child.exitCode===null){const stopped=once(child,"exit");child.kill();await stopped;}
    rmSync(folder,{recursive:true,force:true});
  }
});
