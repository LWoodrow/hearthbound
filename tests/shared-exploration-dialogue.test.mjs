import test from "node:test";
import assert from "node:assert/strict";
import roads from "../server/adventures/eldervale-roads.mjs";
import {createCanonicalState} from "../server/interaction-engine.mjs";
import {createDatabase,createPlayer,getPlayer,getPartyState,setPartyState,listVisibleEvents} from "../server/database.mjs";
import {changeRegionalJourney} from "../server/regional-atlas.mjs";
import {resolveAction} from "../server/dm.mjs";
import {resolveWorldAction,createInitialWorldState} from "../server/world-state.mjs";
import {parseLiteralIntent} from "../server/intent-resolver.mjs";
import {conversationFacts,factualNpcFallback,renderNpcFacts,absentNpcAddress} from "../server/npc-dialogue.mjs";
import {projectNpc,supportedNpcOutput} from "../server/scene-projection.mjs";

test("Read uses authored observations for arbitrary scenery without changing state",()=>{
  for(const label of ["crossing log","noticeboard","painted inscription","public register"]){
    const definition={startLocation:"room",locations:{room:{name:"Room",features:[{id:"writing",label,kind:"scenery",observation:"An authored account."}],exits:[]}}};
    const state=createInitialWorldState(definition);
    const before=structuredClone(state);
    const result=resolveWorldAction({definition,state,action:"read the "+label});
    assert.equal(result.message,"An authored account.");
    assert.deepEqual(state,before);
  }
});

test("Visit is movement globally but retains adjacency and speech boundaries",()=>{
  assert.equal(parseLiteralIntent("visit the inn","act").verb,"move");
  const definition={startLocation:"square",locations:{
    square:{name:"Square",features:[],exits:[{to:"inn",via:"lane"}]},
    inn:{name:"The Inn",aliases:["inn"],features:[],exits:[]},
    remote:{name:"Remote Market",features:[],exits:[]}}};
  let result=resolveWorldAction({definition,state:createInitialWorldState(definition),action:"visit the inn"});
  assert.equal(result.state.currentLocation,"inn");
  result=resolveWorldAction({definition,state:createInitialWorldState(definition),action:"visit remote market"});
  assert.equal(result.state.currentLocation,"square");
  result=resolveWorldAction({definition,state:createInitialWorldState(definition),action:"visit the inn",mode:"speak"});
  assert.equal(result.state.currentLocation,"square");
});

test("model output can select exact facts but cannot publish arbitrary or uncited prose",()=>{
  const npc={name:"Test",role:"resident"},facts=["The bell is damaged.","The mooring is repaired."];
  assert.equal(renderNpcFacts(npc,facts,{factIds:[1]}),'“The mooring is repaired.”');
  assert.equal(supportedNpcOutput({reply:"Invented beer.",usedFacts:[]},facts),false);
  assert.equal(supportedNpcOutput({reply:"The bell is at the landing.",usedFacts:[facts[0]]},facts),false);
  for(const output of [{reply:"Beer is served.",usedFacts:[]},{factIds:[0],reply:"The bell is at the landing."},{factIds:[2]},{factIds:[-1]},{factIds:["0"]},{factIds:[0,0]},{factIds:[0,1,0]},{}])
    assert.equal(renderNpcFacts(npc,facts,output),null);
  assert.doesNotMatch(factualNpcFallback(npc,"beer please",facts),/served|hands|pint|damaged/);
  assert.match(factualNpcFallback(npc,"need any help?",facts),/bell|mooring/);
  assert.deepEqual(conversationFacts(["A public fact.","Purchases are not implemented."]),["A public fact."]);
});

test("real Roads Visit and Read use adjacent aliases and retain explicit clue interactions",async()=>{
  const db=createDatabase(":memory:");
  try{
    const player=createPlayer(db,{partyId:"party-first-company",name:"Reader",species:"Human"});
    changeRegionalJourney(db,player,"explore");
    const world=createCanonicalState(roads,{currentLocation:"ferry",visited:["city","ferry"]});
    setPartyState(db,player.partyId,"world:eldervale-roads",world);
    await resolveAction(db,getPlayer(db,player.id),"act","visit the inn");
    let state=getPartyState(db,player.partyId,"world:eldervale-roads");
    assert.equal(state.currentLocation,"stonecross-inn",listVisibleEvents(db,player).at(-1).text);
    await resolveAction(db,getPlayer(db,player.id),"act","read the river journal");
    state=getPartyState(db,player.partyId,"world:eldervale-roads");
    assert.equal(state.flags.stonecrossBellKnown,true);
    assert.equal(state.flags.stonecrossBellEvidence,true);
    assert.equal(state.flags.stonecrossBellRestored,false);
    await resolveAction(db,getPlayer(db,player.id),"act","visit the town centre market");
    assert.equal(getPartyState(db,player.partyId,"world:eldervale-roads").currentLocation,"stonecross-inn");
  }finally{db.close();}
});

test("Stonecross current knowledge distinguishes rats, bell, and crossing without undoing work",()=>{
  const npc=roads.story.npcs["stonecross-boatwright"];
  let world=createCanonicalState(roads,{currentLocation:"stonecross-boatyard"});
  let facts=projectNpc(npc,world).facts;
  assert.match(factualNpcFallback(npc,"what about the rats?",conversationFacts(facts)),/Marsh rats/);
  world.flags.stonecrossRatsResolved=true;world.flags.ferryRepaired=true;world.flags.stonecrossBellRestored=true;
  facts=projectNpc(npc,world).facts;
  assert.ok(facts.some(f=>/mooring.*crossing remains/.test(f)));
  assert.ok(!facts.some(f=>/mooring is frayed|rats are nesting|bell is damaged/.test(f)));
  assert.match(factualNpcFallback(npc,"rats?",conversationFacts(facts)),/dealt with/);
});

test("natural help speech reaches a sole resident, not a known absent addressee, and never changes world",async()=>{
  const db=createDatabase(":memory:");
  try{
    const player=createPlayer(db,{partyId:"party-first-company",name:"Traveller",species:"Human",className:"Fighter"});
    changeRegionalJourney(db,player,"explore");
    const world=createCanonicalState(roads,{currentLocation:"stonecross-boatyard",visited:["city","ferry","stonecross-boatyard"]});
    setPartyState(db,player.partyId,"world:eldervale-roads",world);
    await resolveAction(db,getPlayer(db,player.id),"speak","need any help?");
    assert.equal(listVisibleEvents(db,player).at(-1).speaker,"Edda Quill");
    assert.match(listVisibleEvents(db,player).at(-1).text,/bell|report|mooring/i);
    assert.deepEqual(getPartyState(db,player.partyId,"world:eldervale-roads"),world);
    await resolveAction(db,getPlayer(db,player.id),"speak","hello Jory");
    assert.notEqual(listVisibleEvents(db,player).at(-1).speaker,"Edda Quill");
    assert.notEqual(listVisibleEvents(db,player).at(-1).speaker,"Jory Pike");
    assert.deepEqual(getPartyState(db,player.partyId,"world:eldervale-roads"),world);
    assert.equal(absentNpcAddress(roads,"where is Jory?",npc=>npc.name==="Edda Quill"),false);
  }finally{db.close();}
});
