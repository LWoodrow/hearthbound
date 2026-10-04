import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createDatabase,buildLobby,createPlayer,getPlayer,getPartyState,setPartyState,getActiveAdventure,listVisibleEvents} from "../server/database.mjs";
import {resolveAction} from "../server/dm.mjs";
import {startLocationEncounter,resolveCombatRoll} from "../server/combat.mjs";
import {createCanonicalState,canonicalProjection} from "../server/interaction-engine.mjs";
import lantern from "../server/adventures/lantern-below.mjs";
import {buildStoryAuthority} from "../server/story-authority.mjs";
import {projectScene,projectNpc,supportedNpcOutput} from "../server/scene-projection.mjs";
import {resolveWorldAction} from "../server/world-state.mjs";
import {validateAdventure} from "../server/adventure-schema.mjs";
import {assessNarrationOutcome} from "../server/turn-traces.mjs";

function fixture() {
  const folder=mkdtempSync(join(tmpdir(),"hearthbound-lifecycle-"));
  const db=createDatabase(join(folder,"test.sqlite"));
  const party=buildLobby(db).worlds[0].parties[0];
  const player=createPlayer(db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});
  const act=(text,mode="act")=>resolveAction(db,getPlayer(db,player.id),mode,text);
  const state=()=>getPartyState(db,party.id,"world:lantern-below");
  const seed=(location,flags={})=>{
    const world=createCanonicalState(lantern,{currentLocation:location,visited:[location],flags});
    setPartyState(db,party.id,"world:lantern-below",world);
    setPartyState(db,party.id,"dm",canonicalProjection(lantern,world));
    return world;
  };
  return {db,party,player,act,state,seed,close(){db.close();rmSync(folder,{recursive:true,force:true});}};
}

test("the letter hook names a sealed message, not its sender, and asking reaches it",async()=>{
  const f=fixture();
  try {
    await f.act("enter the inn");
    const welcome=listVisibleEvents(f.db,f.player).at(-1).text;
    assert.match(welcome,/adventurers.*sealed silver-moth letter/i);
    assert.doesNotMatch(welcome,/Mara|Briarwatch/i);
    await f.act("ask about the letter","speak");
    assert.equal(f.state().currentLocation,"back-room");
    assert.equal(f.state().flags.letterOpened,false);
  } finally {f.close();}
});

test("current scene and NPC projections remove obsolete conditions and hidden exits",()=>{
  const world=createCanonicalState(lantern,{currentLocation:"alcove",flags:{guardianDefeated:true,maraRescued:true}});
  const scene=projectScene(lantern,world);
  assert.match(scene.description,/Mara Vey is free/);
  assert.ok(!scene.visibleFeatures.some((feature)=>["ink-guardian","loose-stones"].includes(feature.id)));
  const npc=projectNpc(lantern.story.npcs["mara-vey"],world);
  assert.ok(!npc.goals.includes("Survive the collapse"));
  assert.ok(!npc.facts.some((fact)=>/remains behind/i.test(fact)));
  const authority=buildStoryAuthority(lantern,{worldState:world,dmState:canonicalProjection(lantern,world)});
  assert.ok(!authority.fixedTruths.some((truth)=>truth.id==="mara-alive"));
  assert.equal(authority.currentScene.act.id,"aftermath");
  const unrevealed=createCanonicalState(lantern,{currentLocation:"mothglass"});
  assert.ok(!projectScene(lantern,unrevealed).exits.some((exit)=>exit.to==="passage"));
  const passage=createCanonicalState(lantern,{currentLocation:"cellar-passage"});
  assert.match(projectScene(lantern,passage).description,/open mothglass chamber entrance/i);
  assert.equal(supportedNpcOutput({reply:"Invented",usedFacts:["She is trapped"]},npc.facts),false);
  assert.equal(assessNarrationOutcome({narration:"An unsupported condition is claimed."}).status,"unassessed");
});

test("nearby NPC call responses respect authored hearing range and rescue state",()=>{
  const call=(location,flags={})=>resolveWorldAction({definition:lantern,state:createCanonicalState(lantern,{currentLocation:location,flags}),action:"call out for anyone nearby"}).message;
  assert.match(call("passage"),/Mara Vey answers.*Here!/);
  assert.doesNotMatch(call("cellar"),/Mara Vey/);
  assert.doesNotMatch(call("passage",{maraRescued:true}),/stones have my legs/);
  const closed=createCanonicalState(lantern,{currentLocation:"passage"});
  closed.objects["alcove-opening"].open=false;
  assert.doesNotMatch(resolveWorldAction({definition:lantern,state:closed,action:"call out"}).message,/Mara Vey answers/);
});

test("NPC conversation drops memory from older world revisions",async()=>{
  const f=fixture();
  try {
    const world=f.seed("inn");
    setPartyState(f.db,f.party.id,"npcConversation:lantern-below:tamsin-reed",[{worldRevision:world.revision-1,reply:"An obsolete condition"}]);
    await f.act("hello Tamsin","speak");
    const memory=getPartyState(f.db,f.party.id,"npcConversation:lantern-below:tamsin-reed");
    assert.equal(memory.length,1);
    assert.equal(memory[0].worldRevision,world.revision);
    assert.doesNotMatch(JSON.stringify(memory),/obsolete condition/);
  } finally {f.close();}
});

test("authored entry encounters ambush first and resolve independently without respawning",async()=>{
  const f=fixture();
  const random=Math.random;
  try {
    Math.random=()=>.5;
    let world=f.seed("cellar");
    startLocationEncounter(f.db,f.player,lantern,world);
    assert.equal(getPartyState(f.db,f.party.id,"combat").encounterId,"lantern-cellar-swarm");
    await f.act("hold the torch on the swarm");
    assert.equal(f.state().flags.cellarSwarmResolved,true);
    assert.equal(f.state().flags.guardianDefeated,false);
    assert.equal(startLocationEncounter(f.db,f.player,lantern,f.state()),null);
    world=f.seed("alcove",{cellarSwarmResolved:true});
    const beforeEvents=listVisibleEvents(f.db,f.player).length;
    startLocationEncounter(f.db,f.player,lantern,world);
    const events=listVisibleEvents(f.db,f.player).slice(beforeEvents);
    assert.match(events[0].text,/Ambush/);
    assert.match(events[1].text,/Ink-dark guardian lashes at Nigel/);
    assert.equal(getPartyState(f.db,f.party.id,"combat").order[0].type,"enemy");
    assert.equal(getPartyState(f.db,f.party.id,"combat").pendingRoll,null);
    await f.act("shine the lantern at the guardian");
    assert.equal(f.state().flags.guardianDefeated,true);
    assert.equal(f.state().flags.cellarSwarmResolved,true);
    assert.equal(startLocationEncounter(f.db,f.player,lantern,f.state()),null);
  } finally {Math.random=random;f.close();}
});

test("actual authored rescue completes campaign and rewards once, with a stable onward lead",async()=>{
  const f=fixture();
  try {
    f.seed("alcove",{guardianDefeated:true});
    await f.act("clear the loose stones");
    assert.equal(f.state().flags.maraRescued,true);
    assert.equal(getActiveAdventure(f.db,f.party.id).status,"complete");
    assert.ok(getPartyState(f.db,f.party.id,"pendingLevelUps")[f.player.id]);
    const milestones=()=>listVisibleEvents(f.db,f.player).filter((event)=>event.speaker==="Milestone");
    assert.equal(milestones().length,1);
    const revision=f.state().revision;
    await f.act("are you okay Mara?","speak");
    await f.act("clear the loose stones again");
    const text=listVisibleEvents(f.db,f.player).filter((event)=>event.speaker==="Mara Vey").at(-1).text;
    assert.match(text,/Briarwatch/);
    assert.doesNotMatch(text,/still trapped|legs are caught|guardian still/i);
    assert.equal(milestones().length,1);
    assert.equal(f.state().revision,revision);
    assert.equal(lantern.milestones.complete.nextAdventure,"ashes-briarwatch");
  } finally {f.close();}
});

test("rescue and campaign completion roll back together if reward persistence fails",async()=>{
  const f=fixture();
  try {
    f.seed("alcove",{guardianDefeated:true});
    const before=f.state();
    const events=listVisibleEvents(f.db,f.player).length;
    f.db.exec("CREATE TRIGGER reject_reward BEFORE INSERT ON party_state WHEN NEW.key='pendingLevelUps' BEGIN SELECT RAISE(ABORT,'test reward failure'); END");
    await assert.rejects(f.act("clear the loose stones"),/test reward failure/);
    assert.deepEqual(f.state(),before);
    assert.equal(getActiveAdventure(f.db,f.party.id).status,"active");
    assert.equal(listVisibleEvents(f.db,f.player).length,events);
  } finally {f.close();}
});

test("already-rescued older saves repair campaign completion without resetting the world",async()=>{
  const f=fixture();
  try {
    const before=f.seed("alcove",{guardianDefeated:true,maraRescued:true,adventureComplete:true});
    await f.act("Mara?","speak");
    assert.equal(getActiveAdventure(f.db,f.party.id).status,"complete");
    assert.deepEqual(f.state(),before);
    assert.match(listVisibleEvents(f.db,f.player).at(-1).text,/Briarwatch/);
  } finally {f.close();}
});

test("an authored combat resolution preserves declared resource costs and stable revisions",async()=>{
  const f=fixture();
  const random=Math.random;
  try {
    Math.random=()=>.5;
    const world=f.seed("alcove");
    startLocationEncounter(f.db,f.player,lantern,world);
    await f.act("throw ink at the guardian");
    assert.equal(f.state().resources.ink,0);
    assert.equal(f.state().flags.guardianDefeated,true);
    assert.equal(getPartyState(f.db,f.party.id,"combat").active,false);
    const revision=f.state().revision;
    await f.act("throw ink at the guardian again");
    assert.equal(f.state().resources.ink,0);
    assert.equal(f.state().revision,revision);
  } finally {Math.random=random;f.close();}
});

test("encounter and hearing definitions reject missing controls instead of silently improvising",()=>{
  const bad=structuredClone(lantern);
  bad.encounters[0].resolvedFlag="undeclaredFlag";
  bad.story.npcs["mara-vey"].audibleFrom=["inn"];
  const validation=validateAdventure(bad);
  assert.equal(validation.valid,false);
  assert.ok(validation.errors.some((error)=>/resolvedFlag/.test(error)));
  assert.ok(validation.errors.some((error)=>/adjacent/.test(error)));
});

test("a complete authored descent fights both encounters and ends in the Briarwatch handoff",async()=>{
  const f=fixture();
  const random=Math.random;
  try {
    Math.random=()=>.5;
    const steps=[
      ["enter the inn"],["ask about the letter","speak"],["open the letter"],
      ["warm the ink mite with the lamp"],["give the mite fresh ink"],
      ["take the lantern"],["go back to the taproom"],
      ["show Mara's note to Tamsin","speak"],["enter the kitchen"],["enter the pantry"],
      ["search the pantry shelves"],["open the cellar hatch"],["descend to the cellar"],
    ];
    for (const [text,mode] of steps) await f.act(text,mode);
    assert.equal(f.state().currentLocation,"cellar");
    const fight=async()=>{
      assert.equal(getPartyState(f.db,f.party.id,"combat").active,true);
      await f.act("attack the enemy");
      resolveCombatRoll(f.db,getPlayer(f.db,f.player.id),20,20);
      resolveCombatRoll(f.db,getPlayer(f.db,f.player.id),6,6);
      assert.equal(getPartyState(f.db,f.party.id,"combat").outcome,"victory");
    };
    await fight();
    assert.equal(f.state().flags.cellarSwarmResolved,true);
    assert.equal(f.state().flags.guardianDefeated,false);
    for (const text of ["take the cellar key","use the cellar key on the stone door","go through the stone door",
      "enter the mothglass chamber","turn the brass lantern","enter the concealed survey passage"]) await f.act(text);
    assert.equal(f.state().currentLocation,"passage");
    assert.equal(listVisibleEvents(f.db,f.player).filter((event)=>event.payload.entryBeat==="mara-hears-approach").length,1);
    await f.act("call out for anyone close");
    assert.match(listVisibleEvents(f.db,f.player).at(-1).text,/Mara Vey answers/);
    await f.act("follow the black ink towards the collapse");
    assert.equal(f.state().currentLocation,"alcove");
    await fight();
    await f.act("clear the loose stones");
    assert.equal(getActiveAdventure(f.db,f.party.id).status,"complete");
    await f.act("where should we go next Mara?","speak");
    assert.match(listVisibleEvents(f.db,f.player).at(-1).text,/Briarwatch.*north road/);
  } finally {Math.random=random;f.close();}
});
