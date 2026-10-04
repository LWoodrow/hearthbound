import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {createServer} from "node:http";
import {fileURLToPath} from "node:url";
import {createDatabase,buildLobby,createPlayer,getPlayer,getPartyState,setPartyState,getActiveAdventure,listVisibleEvents,getLevelUpOptions,levelUpPlayer} from "../server/database.mjs";
import {resolveAction} from "../server/dm.mjs";
import {createCanonicalState,canonicalProjection,resolveAuthoredInteraction,journeyAvailable} from "../server/interaction-engine.mjs";
import {buildSceneCommandSurface} from "../server/scene-command-surface.mjs";
import {interpretSceneTurn} from "../server/turn-interpretation.mjs";
import {aftermathView} from "../server/aftermath.mjs";
import {npcLocations,npcCanHear} from "../server/world-state.mjs";
import {validateAdventure} from "../server/adventure-schema.mjs";
import lantern from "../server/adventures/lantern-below.mjs";
import {loginPlayer} from "../server/database.mjs";

function fixture() {
  const folder=mkdtempSync(join(tmpdir(),"hearthbound-closing-"));
  const db=createDatabase(join(folder,"test.sqlite"));
  const party=buildLobby(db).worlds[0].parties[0];
  const player=createPlayer(db,{partyId:party.id,name:"Neil",species:"Human",className:"Fighter"});
  const state=()=>getPartyState(db,party.id,"world:lantern-below");
  const seed=(location,extra={})=>{
    const world=createCanonicalState(lantern,{currentLocation:location,visited:[location],...extra});
    setPartyState(db,party.id,"world:lantern-below",world);
    setPartyState(db,party.id,"dm",canonicalProjection(lantern,world));
    return world;
  };
  return {db,party,player,state,seed,act:(text,mode="act")=>resolveAction(db,getPlayer(db,player.id),mode,text),close(){db.close();rmSync(folder,{recursive:true,force:true});}};
}

test("an unresolved first turn cannot narrate AI movement before canonical migration",async()=>{
  const f=fixture();
  try {
    const result=await f.act("do inside the crooked lantern");
    assert.equal(result.rule,"unresolved-structured-action");
    assert.equal(result.source,"rules");
    assert.equal(result.accepted,false);
    assert.equal(f.state()?.currentLocation || lantern.startLocation,"outside-inn");
    assert.doesNotMatch(result.narration,/company enters|party enters/i);
    await f.act("enter the inn");
    assert.equal(f.state().currentLocation,"inn");
  } finally {f.close();}
});

test("authored social affordances accept polite fragments but not unrelated small talk",async()=>{
  for (const text of ["somewhere quiet to sit please tamsin","a private place please","some privacy please"]) {
    const f=fixture();
    try {f.seed("inn");await f.act(text);assert.equal(f.state().currentLocation,"back-room",text);} finally {f.close();}
  }
  const f=fixture();
  try {
    f.seed("inn");
    for (const text of ["some drinks please","what is the quiet room like?","look at the private room door"]) {
      await f.act(text,text.startsWith("what")?"speak":"act");
      assert.equal(f.state().currentLocation,"inn",text);
    }
  } finally {f.close();}
  const generic=structuredClone(lantern);
  generic.id="another-world";
  generic.interactions=[{id:"request-seat",location:"inn",modes:["act","speak"],verbs:["request"],targets:["shelter"],request:{implicit:true,subjects:["shelter"]},effects:[{op:"set",path:"flags.shelterGranted",value:true}],outcome:{message:"Shelter is granted."}}];
  const result=resolveAuthoredInteraction({definition:generic,state:createCanonicalState(generic,{currentLocation:"inn"}),action:"some shelter please"});
  assert.equal(result.state.flags.shelterGranted,true);
  generic.interactions.push({...generic.interactions[0],id:"different-shelter",effects:[{op:"set",path:"flags.otherShelter",value:true}]});
  const ambiguous=resolveAuthoredInteraction({definition:generic,state:createCanonicalState(generic,{currentLocation:"inn"}),action:"some shelter please"});
  assert.equal(ambiguous.reason,"ambiguous-request");
  assert.equal(ambiguous.state.flags.shelterGranted,undefined);
});

test("short nouns resolve local items unambiguously without spelling correction",async()=>{
  const f=fixture();
  try {
    f.seed("cellar",{flags:{cellarSwarmResolved:true}});
    await f.act("pickup key");
    assert.equal(f.state().itemOwners["cellar-key"],f.player.id);
    await f.act("unlock stone door with key");
    assert.equal(f.state().objects["keyed-stone-door"].locked,false);
    assert.equal(f.state().objects["keyed-stone-door"].open,false);
    assert.match(listVisibleEvents(f.db,f.player).at(-1).text,/closed.*open it/i);
    await f.act("open stone door");
    await f.act("go through stone door");
    assert.equal(f.state().currentLocation,"cellar-passage");
  } finally {f.close();}
  const generic=structuredClone(lantern);
  generic.items={one:{name:"Iron key",location:"cellar",portable:true},two:{name:"Brass key",location:"cellar",portable:true},remote:{name:"Map",location:"inn",portable:true}};
  const surface=buildSceneCommandSurface(generic,createCanonicalState(generic,{currentLocation:"cellar"}));
  assert.equal(interpretSceneTurn(surface,"take key").sceneReference.selected,null);
  assert.equal(interpretSceneTurn(surface,"take key").sceneReference.candidates.length,2);
  assert.equal(interpretSceneTurn(surface,"take iron key").sceneReference.selected.id,"one");
  assert.equal(interpretSceneTurn(surface,"take kee").sceneReference.selected,null);
  assert.equal(interpretSceneTurn(surface,"take monkey").sceneReference.selected,null);
  assert.equal(interpretSceneTurn(surface,"take map").sceneReference.selected,null);
});

test("nearby spoken conversation shares hearing but never grants remote physical reach",async()=>{
  const f=fixture();
  try {
    const before=f.seed("passage");
    for (const text of ["who is that?","shout out to mara","mara is that you?"]) {
      const result=await f.act(text,"speak");
      assert.equal(result.rule,"npc-conversation");
      assert.equal(listVisibleEvents(f.db,f.player).at(-1).speaker,"Mara Vey");
      assert.deepEqual(f.state(),before);
    }
    await f.act("move rocks");
    assert.deepEqual(f.state(),before);
    assert.equal(interpretSceneTurn(buildSceneCommandSurface(lantern,before),"move rocks").worldIntent,"other");
    await f.act("attack ink monster");
    assert.equal(f.state().currentLocation,"passage");
    assert.equal(f.state().flags.guardianDefeated,false);
    const closed={...before,objects:{...before.objects,"alcove-opening":{open:false}}};
    f.seed("passage",closed);
    const reply=await f.act("Mara, can you hear us?","speak");
    assert.equal(reply.rule,"state-neutral-speech");
  } finally {f.close();}
});

test("unsupported scenery operations explain their boundary without inventing contents",async()=>{
  const f=fixture();
  try {
    const before=f.seed("cellar");
    await f.act("open barrels");
    assert.match(listVisibleEvents(f.db,f.player).at(-1).text,/scenery.*no opening or contents/i);
    assert.deepEqual(f.state(),before);
    await f.act("search barrels");
    assert.match(listVisibleEvents(f.db,f.player).at(-1).text,/No further contents or details/i);
    await f.act("search battels");
    assert.deepEqual(f.state(),before);
  } finally {f.close();}
});

test("the authored escort checks each threshold, moves NPC presence and preserves earned rewards",async()=>{
  const f=fixture();
  try {
    const journey=lantern.interactions.find((entry)=>entry.id === "escort-mara-to-inn").journey;
    const objects=Object.fromEntries(Object.entries(lantern.objects).map(([id])=>[id,{open:true,locked:false,discovered:true}]));
    const before=f.seed("alcove",{visited:journey,objects,flags:{guardianDefeated:true,cellarSwarmResolved:true}});
    await f.act("clear the loose stones");
    assert.equal(getActiveAdventure(f.db,f.party.id).status,"complete");
    const rewards=getPartyState(f.db,f.party.id,"pendingLevelUps");
    for (const id of ["keyed-stone-door","spindle-door","pantry-door","kitchen-door"]) {
      const blocked=structuredClone(f.state());blocked.objects[id].open=false;
      assert.equal(journeyAvailable(lantern,blocked,journey),false,id);
      const result=resolveAuthoredInteraction({definition:lantern,state:blocked,action:"escort Mara back to Tamsin at the inn"});
      assert.equal(result.accepted,false,id);
      assert.deepEqual(result.state,blocked);
    }
    await f.act("escort Mara back to Tamsin at the inn");
    assert.equal(f.state().currentLocation,"inn");
    assert.equal(f.state().flags.maraSafeAtInn,true);
    assert.deepEqual(npcLocations(lantern.story.npcs["mara-vey"],f.state()),["inn"]);
    assert.equal(npcCanHear(lantern,{...f.state(),currentLocation:"passage"},lantern.story.npcs["mara-vey"]),false);
    assert.deepEqual(getPartyState(f.db,f.party.id,"pendingLevelUps"),rewards);
    assert.equal(getPartyState(f.db,f.party.id,"combat"),null);
    await f.act("are you okay Mara?","speak");
    assert.match(listVisibleEvents(f.db,f.player).at(-1).text,/Tamsin.*Briarwatch/);
    await f.act("Mara, will Tamsin look after you?","speak");
    assert.equal(listVisibleEvents(f.db,f.player).at(-1).speaker,"Mara Vey");
    await f.act("Tamsin, look after Mara please","speak");
    assert.equal(listVisibleEvents(f.db,f.player).at(-1).speaker,"Tamsin Reed");
    await f.act("who is here?");
    assert.match(listVisibleEvents(f.db,f.player).at(-1).text,/Tamsin Reed.*Mara Vey/);
    await f.act("rest by the hearth");
    assert.equal(f.state().flags.aftermathRested,true);
    const revision=f.state().revision;
    await f.act("rest by the hearth again");
    assert.equal(f.state().revision,revision);
    const options=getLevelUpOptions(f.db,f.player.id);
    levelUpPlayer(f.db,f.player.id,{subclass:options.subclassChoices[0]});
    assert.equal(f.state().currentLocation,"inn");
    const nextOptions=getLevelUpOptions(f.db,f.player.id);
    levelUpPlayer(f.db,f.player.id,{subclass:nextOptions.subclassChoices[0]});
    assert.equal(getPlayer(f.db,f.player.id).level,3);
    assert.equal(getLevelUpOptions(f.db,f.player.id),null);
    assert.equal(listVisibleEvents(f.db,f.player).filter((entry)=>entry.speaker === "Milestone").length,1);
    const adventures=buildLobby(f.db).worlds[0].adventures;
    const closing=aftermathView(lantern,f.state(),{status:"complete",adventures,players:[getPlayer(f.db,f.player.id)]});
    assert.match(closing.nextAdventure.title,/Briarwatch/);
    assert.equal(closing.nextAdventure.available,true);
    assert.equal(aftermathView(lantern,f.state(),{status:"complete",adventures,players:[{level:1}]}).nextAdventure.available,false);
    assert.equal(aftermathView(lantern,before,{status:"active",adventures}),null);
  } finally {f.close();}
});

test("journey and conditional NPC authoring rejects invalid paths and presence",()=>{
  const bad=structuredClone(lantern);
  bad.interactions.find((entry)=>entry.id === "escort-mara-to-inn").journey=["alcove","inn"];
  bad.story.npcs["mara-vey"].presence[0].locations=["nowhere"];
  const result=validateAdventure(bad);
  assert.equal(result.valid,false);
  assert.ok(result.errors.some((entry)=>entry.includes("journey")));
  assert.ok(result.errors.some((entry)=>entry.includes("presence")));
});

test("milestone controls stay in the adventure rather than redirecting to a sheet",()=>{
  const source=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  assert.match(source,/onCompleted=\{\(\)=>\{setActiveTab\("adventure"\)/);
  assert.doesNotMatch(source,/setLevelUpOpen\(true\);setActiveTab\("character"\)/);
  assert.match(source,/\/api\/adventure\/continue/);
});

test("HTTP closing flow keeps speech private, rechecks levels and starts only the authored next adventure",async()=>{
  const folder=mkdtempSync(join(tmpdir(),"hearthbound-closing-http-"));
  const filename=join(folder,"campaign.sqlite");
  const db=createDatabase(filename);
  const party=buildLobby(db).worlds[0].parties[0];
  const player=createPlayer(db,{partyId:party.id,name:"Neil",species:"Human",className:"Fighter"});
  const state=createCanonicalState(lantern,{currentLocation:"inn",visited:["inn","alcove"],flags:{maraRescued:true,maraSafeAtInn:true,guardianDefeated:true,adventureComplete:true}});
  setPartyState(db,party.id,"world:lantern-below",state);
  setPartyState(db,party.id,"dm",canonicalProjection(lantern,state));
  await resolveAction(db,player,"speak","Mara, are you okay?");
  const session=loginPlayer(db,player.id);
  db.close();
  const reservation=createServer();reservation.listen(0,"127.0.0.1");await once(reservation,"listening");
  const port=reservation.address().port;await new Promise(done=>reservation.close(done));
  const base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,["server/index.mjs"],{cwd:fileURLToPath(new URL("../",import.meta.url)),windowsHide:true,stdio:"ignore",env:{...process.env,PORT:String(port),HOST:"127.0.0.1",DND_DATABASE:filename,AI_SETTINGS_FILE:join(folder,"ai.json"),AI_PROVIDER:"llamacpp",AI_BASE_URL:"http://127.0.0.1:1",AI_MODEL:"test",AI_AUTO_START:"false",HTTPS_KEY:"",HTTPS_CERT:""}});
  const headers={"Authorization":`Bearer ${session.token}`,"Content-Type":"application/json"};
  const game=async()=>(await fetch(`${base}/api/game`,{headers})).json();
  try {
    let ready=false;
    for (let i=0;i<60;i++) {try {ready=(await fetch(`${base}/api/lobby`)).ok;} catch {} if(ready) break;await new Promise(done=>setTimeout(done,100));}
    assert.equal(ready,true,"isolated server starts");
    assert.equal((await fetch(`${base}/api/adventure/continue`,{method:"POST"})).status,401);
    assert.equal((await fetch(`${base}/api/adventure/continue`,{method:"POST",headers,body:"{}"})).status,409);
    const before=await game();assert.match(before.aftermath.title,/Safe/);
    const privateReply=await fetch(`${base}/api/action`,{method:"POST",headers,body:JSON.stringify({mode:"speak",audience:"party",text:"Mara, can you hear this?"})});
    assert.equal((await privateReply.json()).source,"party-conversation");
    const after=await game();
    assert.equal(after.events.filter((entry)=>entry.speaker === "Mara Vey").length,before.events.filter((entry)=>entry.speaker === "Mara Vey").length);
    for (let i=0;i<2;i++) {
      const view=await game();
      const result=await fetch(`${base}/api/workshop/level-up`,{method:"POST",headers,body:JSON.stringify({subclass:view.levelUp.subclassChoices[0]})});
      assert.equal(result.status,200);
      assert.match((await game()).recap.currentLocation,/Taproom/);
    }
    assert.equal((await game()).aftermath.nextAdventure.available,true);
    const started=await fetch(`${base}/api/adventure/continue`,{method:"POST",headers,body:JSON.stringify({adventureId:"wrong-destination"})});
    assert.equal(started.status,200);
    assert.match((await started.json()).adventure.id,/ashes-briarwatch$/);
    assert.match((await game()).campaign.title,/Briarwatch/);
    assert.equal((await fetch(`${base}/api/adventure/continue`,{method:"POST",headers,body:"{}"})).status,409);
  } finally {
    if(child.exitCode === null) {const stopped=once(child,"exit");child.kill();await stopped;}
    rmSync(folder,{recursive:true,force:true});
  }
});
