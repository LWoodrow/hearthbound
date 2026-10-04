import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {regionalResidents,withRegionalResidents} from "../server/adventures/regional-residents.mjs";
import roads from "../server/adventures/eldervale-roads.mjs";
import {willowfordNpcs,willowfordLocations} from "../server/adventures/willowford.mjs";
import {rivergateNpcs,rivergateLocations} from "../server/adventures/rivergate.mjs";
import {stonecrossNpcs,stonecrossLocations} from "../server/adventures/stonecross.mjs";
import {PORTRAIT_SPECIES} from "../shared/player-portraits.mjs";
import {NPC_PORTRAIT_CROPS,visibleNpcProfiles,visibleNpcPortraits} from "../shared/portrait-catalogue.mjs";
import {createCanonicalState} from "../server/interaction-engine.mjs";
import {projectScene,projectNpc} from "../server/scene-projection.mjs";
import {createDatabase,createPlayer,getPlayer,getPartyState,setPartyState,listVisibleEvents,listInventory,getActiveAdventure} from "../server/database.mjs";
import {changeRegionalJourney,regionalAtlasView,regionalTravelCommand} from "../server/regional-atlas.mjs";
import {resolveAction} from "../server/dm.mjs";
import {createInitialWorldState,resolveWorldAction} from "../server/world-state.mjs";

test("additional cast spans nine non-human species and seven public regions without replacing original residents or locations",()=>{
  assert.equal(regionalResidents.length,10);
  assert.deepEqual([...new Set(regionalResidents.map(r=>r.species))].sort(),PORTRAIT_SPECIES.filter(s=>s!=="Human").sort());
  for(const original of [willowfordNpcs,rivergateNpcs,stonecrossNpcs])for(const [id,npc] of Object.entries(original)){
    const added=roads.story.npcs[id];
    for(const field of ["name","role","locations","portraitId","appearance","publicBackground","goals","voice","mustNotKnow"]) assert.deepEqual(added[field],npc[field],id+" "+field);
    assert.deepEqual(added.conversation.conditionalFacts,npc.conversation.conditionalFacts);
    assert.ok(npc.conversation.publicFacts.every(fact=>added.conversation.publicFacts.includes(fact)));
  }
  for(const original of [willowfordLocations,rivergateLocations,stonecrossLocations])for(const [id,location] of Object.entries(original)){
    assert.deepEqual(roads.locations[id].map,location.map);
    assert.ok(location.exits.every(exit=>roads.locations[id].exits.some(next=>JSON.stringify(next)===JSON.stringify(exit))));
    assert.ok(location.features.every(feature=>roads.locations[id].features.some(next=>JSON.stringify(next)===JSON.stringify(feature))));
    assert.ok(location.entryBeats.every(beat=>roads.locations[id].entryBeats.some(next=>JSON.stringify(next)===JSON.stringify(beat))));
  }
  assert.equal(roads.story.npcs.ranger.name,"Rowan Ash");
  assert.equal(roads.story.npcs.keeper.name,"Keeper Iona");
  assert.equal(roads.story.npcs.watcher.name,"Perrin Vale");
  const parents={city:"city",market:"market","rivergate-warehouse":"market","rivergate-coach":"market",village:"village","willow-smithy":"village","stonecross-hut":"ferry","stonecross-reeds":"ferry",wood:"wood",abbey:"abbey",hill:"hill"};
  assert.equal(new Set(regionalResidents.map(r=>parents[r.location])).size,7);
});

test("each new resident has exact local presence, bounded craft facts and reviewed gender/species-correct portrait disclosure",()=>{
  assert.deepEqual(visibleNpcProfiles(roads,[]),{});
  for(const resident of regionalResidents){
    const npc=roads.story.npcs[resident.id],crop=NPC_PORTRAIT_CROPS[npc.portraitId];
    assert.equal(crop.species,resident.species);
    assert.equal(crop.gender,resident.gender);
    assert.equal(readFileSync(new URL("../public"+crop.file,import.meta.url)).subarray(1,4).toString(),"PNG");
    assert.match(npc.publicBackground,new RegExp(resident.species,"i"));
    const scene=projectScene(roads,createCanonicalState(roads,{currentLocation:resident.location}));
    assert.ok(scene.visibleFeatures.some(feature=>feature.id===resident.id));
    assert.ok(scene.visibleFeatures.some(feature=>feature.id===resident.feature.id));
    const elsewhere=projectScene(roads,createCanonicalState(roads,{currentLocation:resident.location==="city"?"hill":"city"}));
    assert.ok(!elsewhere.visibleFeatures.some(feature=>feature.id===resident.id));
    const profiles=visibleNpcProfiles(roads,[{speaker:npc.name}]);
    assert.deepEqual(Object.keys(profiles),[npc.name]);
    assert.equal(profiles[npc.name].background,npc.publicBackground);
    assert.deepEqual(visibleNpcPortraits(roads,[{speaker:npc.name}]),{[npc.name]:npc.portraitId});
    assert.doesNotMatch(JSON.stringify(profiles),/mustNotKnow|conditionalFacts|Hidden main-campaign/);
    assert.ok(projectNpc(npc,{}).facts.includes(npc.publicBackground));
  }
});

test("augmentation preserves saved progress, original backing content and rejects identity collisions",()=>{
  const saved={currentLocation:"stonecross-reeds",visited:["city","market","ferry","stonecross-reeds"],revision:21,
    flags:{ferryRepaired:true,stonecrossBellRestored:true,orchardRestored:true,deliveryResolved:true},
    completedInteractions:["repair-ferry","stonecross-repair-bell"],discoveries:["ferry-restored"],objects:{}};
  const state=createCanonicalState(roads,saved);
  for(const field of ["currentLocation","visited","revision","completedInteractions","discoveries"]) assert.deepEqual(state[field],saved[field]);
  for(const [flag,value] of Object.entries(saved.flags))assert.equal(state.flags[flag],value);
  assert.ok(!stonecrossLocations["stonecross-reeds"].features.some(feature=>feature.id==="stonecross-reedweaver"));
  assert.ok(!willowfordNpcs["willow-smith"].conversation.publicFacts.some(fact=>fact.startsWith("Additional public neighbours")));
  assert.throws(()=>withRegionalResidents(roads),/already exists/);
  assert.throws(()=>withRegionalResidents({story:{npcs:{}},locations:{}}),/no authored location/);
});

test("full observation labels beat shorter overlapping entity IDs regardless of feature order",()=>{
  for(const [short,long] of [["register","register border samples"],["bell","bell maintenance diagram"],["gate","gate hinge sample"]]){
    for(const reverse of [false,true]){
      const features=[{id:short,label:"public "+short,kind:"scenery",observation:"SHORT"},{id:"sample",label:long,kind:"scenery",observation:"SPECIFIC"}];
      const definition={startLocation:"room",locations:{room:{name:"Room",features:reverse?features.reverse():features,exits:[]}}};
      const result=resolveWorldAction({definition,state:createInitialWorldState(definition),action:"look at the "+long});
      assert.equal(result.message,"SPECIFIC",long);
    }
  }
});

test("new residents are physically addressable and their inspection and conversation never alter quests, inventory or location",async()=>{
  const db=createDatabase(":memory:");
  try{
    const player=createPlayer(db,{partyId:"party-first-company",name:"Traveller",species:"Human",className:"Fighter"});
    changeRegionalJourney(db,player,"explore");
    const act=(text,mode="act")=>resolveAction(db,getPlayer(db,player.id),mode,text);
    for(const resident of regionalResidents){
      const state=createCanonicalState(roads,{currentLocation:resident.location,visited:["city",resident.location]});
      setPartyState(db,player.partyId,"world:eldervale-roads",state);
      const before=getPartyState(db,player.partyId,"world:eldervale-roads");
      const inventory=listInventory(db,player.id);
      await act("look at "+resident.feature.label);
      assert.ok(listVisibleEvents(db,player).at(-1).text.includes(resident.feature.observation),resident.id+": "+listVisibleEvents(db,player).at(-1).text);
      await act("hello "+resident.name,"speak");
      assert.equal(listVisibleEvents(db,player).at(-1).speaker,resident.name);
      await act("Who are you?","speak"); // Current conversational partner survives sharing a scene.
      assert.equal(listVisibleEvents(db,player).at(-1).speaker,resident.name);
      assert.deepEqual(getPartyState(db,player.partyId,"world:eldervale-roads"),before);
      assert.deepEqual(listInventory(db,player.id),inventory);
      assert.equal(getActiveAdventure(db,player.partyId).status,"active");
    }
  }finally{db.close();}
});

test("general greetings retain original hosts in shared scenes and an explicitly selected conversational partner",async()=>{
  const db=createDatabase(":memory:");
  try{
    const player=createPlayer(db,{partyId:"party-first-company",name:"Greeter",species:"Human"});
    changeRegionalJourney(db,player,"explore");
    for(const [location,original,newcomer] of [["wood","Rowan Ash","Lethiel Fernwake"],["abbey","Keeper Iona","Seren Dawnmere"]]){
      const state=createCanonicalState(roads,{currentLocation:location,visited:["city",location]});
      setPartyState(db,player.partyId,"world:eldervale-roads",state);
      setPartyState(db,player.partyId,"activeNpcConversation:eldervale-roads:"+player.id,null);
      await resolveAction(db,getPlayer(db,player.id),"speak","hello");
      assert.equal(listVisibleEvents(db,player).at(-1).speaker,original);
      await resolveAction(db,getPlayer(db,player.id),"speak","hello "+newcomer);
      assert.equal(listVisibleEvents(db,player).at(-1).speaker,newcomer);
      await resolveAction(db,getPlayer(db,player.id),"speak","hello");
      assert.equal(listVisibleEvents(db,player).at(-1).speaker,newcomer);
      assert.deepEqual(getPartyState(db,player.partyId,"world:eldervale-roads"),state);
    }
  }finally{db.close();}
});

test("resident welcomes and portrait biographies appear on actual visits, only once, including existing saves",async()=>{
  const db=createDatabase(":memory:");
  try{
    const player=createPlayer(db,{partyId:"party-first-company",name:"Visitor",species:"Human"});
    changeRegionalJourney(db,player,"explore");
    const act=text=>resolveAction(db,getPlayer(db,player.id),"act",text);
    const travel=id=>act(regionalTravelCommand(db,player,id));
    assert.doesNotMatch(JSON.stringify(regionalAtlasView(db,player)),/Torra Coppervein|Varek Embercoil/);
    await travel("market");await travel("rivergate-coach");
    const events=()=>listVisibleEvents(db,player);
    assert.equal(events().filter(event=>event.speaker==="Varek Embercoil").length,1);
    assert.equal(visibleNpcProfiles(roads,events())["Varek Embercoil"].portraitId,"varek");
    assert.equal(visibleNpcProfiles(roads,events())["Torra Coppervein"],undefined);
    await travel("market");await travel("rivergate-coach");
    assert.equal(events().filter(event=>event.speaker==="Varek Embercoil").length,1);
    await travel("market");await travel("rivergate-warehouse");
    assert.ok(events().some(event=>event.speaker==="Harlan Moss"));
    assert.ok(events().some(event=>event.speaker==="Torra Coppervein"));
    // A restored old save does not need a reset to learn the new introduction.
    const saved=getPartyState(db,player.partyId,"world:eldervale-roads");
    saved.flags.deliveryResolved=true;
    setPartyState(db,player.partyId,"world:eldervale-roads",saved);
    await travel("market");await act("Go to Rivergate Coach Stand");
    assert.equal(getPartyState(db,player.partyId,"world:eldervale-roads").flags.deliveryResolved,true);
  }finally{db.close();}
});
