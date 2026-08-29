import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addEvent, addInventoryItem, advancePartySpotlight, buildLobby, completeActiveAdventure, createDatabase, createParty, createPlayer, createWorld, deletePlayer, getGuidanceMode, getKnownLocations, getLevelUpOptions, getPartySpotlight, getPartyState, getPlayer, getPlayerGuidance, levelUpPlayer, listInventory, listRecentEventsForDm, listVisibleEvents, movePlayerToParty, rememberKnownLocation, removeInventoryItem, resetPartyStory, selectAdventure, setGuidanceMode, setPartyState, setPlayerHp } from "../server/database.mjs";
import { directorCheckRequest, ensureCompleteContainerResult, ensureConcreteMovementResult, prepareCampaignContext, resolveAction, resolvePendingCheck, safeNarrationText, sanitizeDirectorConsequences, unresolvedAuthoredMovementResult } from "../server/dm.mjs";
import { applyAdventureEvent, enrichKnownLocations, locationIsRevealed, locationTransitionIsAllowed } from "../server/adventure-rules.mjs";
import { actionUsesSpotlight, canSubmitOutsideCombat, normalizeSpeechAudience } from "../server/spotlight.mjs";
import { COTTON_FULL_NAME, COTTON_ID, cottonForParty, isCottonInteraction } from "../server/cotton.mjs";

test("free-flow exploration allows every player while preserving speech audience", () => {
  assert.equal(normalizeSpeechAudience("speak", undefined), "party");
  assert.equal(normalizeSpeechAudience("speak", "nearby"), "nearby");
  assert.equal(actionUsesSpotlight("act"), true);
  assert.equal(actionUsesSpotlight("speak", "nearby"), true);
  assert.equal(actionUsesSpotlight("speak", "party"), false);
  assert.equal(actionUsesSpotlight("ask"), false);
  const turn = { partySize:3, spotlightPlayerId:"floofell", playerId:"dad" };
  assert.equal(canSubmitOutsideCombat({ ...turn, mode:"act" }), true);
  assert.equal(canSubmitOutsideCombat({ ...turn, mode:"speak", audience:"nearby" }), true);
  assert.equal(canSubmitOutsideCombat({ ...turn, mode:"speak", audience:"party" }), true);
  assert.equal(canSubmitOutsideCombat({ ...turn, mode:"ask" }), true);
});

test("adventure location rules gate discoveries without relying on display wording", () => {
  const id="world-hearthbound-lantern-below";
  assert.equal(locationIsRevealed(id,{clueStage:2},"The Cellar Passage"),false);
  assert.equal(locationIsRevealed(id,{clueStage:4},"The Cellar Passage"),true);
  const mapped=enrichKnownLocations(id,{clueStage:4},[
    {id:"a",name:"The Crooked Lantern",summary:"Inn",firstSeen:"now"},
    {id:"b",name:"The Crooked Lantern cellar",summary:"Cellar",firstSeen:"now"},
    {id:"c",name:"The Cellar Passage",summary:"Passage",firstSeen:"now"},
  ]);
  assert.deepEqual(mapped.map((item)=>item.map.key),["inn","cellar","cellar-passage"]);
  assert.deepEqual(mapped[2].map.connectsTo,["cellar"]);
});

test("adventure events advance monotonically and unknown adventures keep generic mechanics", () => {
  const lantern=applyAdventureEvent("world-hearthbound-lantern-below",{clueStage:8},"keyedDoorOpened");
  assert.equal(lantern.state.clueStage,8);
  const custom=applyAdventureEvent("homebrew-adventure",{clueStage:6},"keyedDoorCrossed");
  assert.deepEqual(custom,{state:{clueStage:6},location:null});
  const generic=enrichKnownLocations("homebrew-adventure",{},[
    {id:"one",name:"Village Gate",summary:"Known",firstSeen:"now"},
    {id:"two",name:"Old Well",summary:"Known",firstSeen:"now"},
  ]);
  assert.equal(generic.length,2);
  assert.deepEqual(generic[1].map.connectsTo,["one"]);
});

test("AI consequence sanitization keeps story authority outside the prose model", () => {
  const raw={
    publicFacts:["  A brass token lies on the desk.  ","The room is unchanged.","A third fact.","A fourth fact must be discarded."],
    privateFact:"The acting player secretly learns the final culprit.",
    hiddenNote:"  Preserve only this private ledger note.  ",
    dangerChange:99,
    adventureComplete:true,
    locationName:"Invented Moon Vault",
    locationNote:"A place invented by the model.",
    requiredCheck:"Wisdom (Perception) DC 12",
    checkReason:"Notice a visible detail before acting.",
    inventoryChanges:[
      {operation:"add",itemName:"Brass token",quantity:999,status:"stored",note:"Found on the desk."},
      {operation:"add",itemName:"Secret crown",quantity:1,status:"equipped",note:"Not requested."},
      {operation:"add",itemName:"Cotton",quantity:1,status:"carried",note:"Never an item."},
      {operation:"add",itemName:"Brass token",quantity:1,status:"carried",note:"Duplicate."},
    ],
  };
  const result=sanitizeDirectorConsequences(raw,"take the brass token");
  assert.deepEqual(result.director.publicFacts,["A brass token lies on the desk.","The room is unchanged.","A third fact."]);
  assert.equal(result.director.privateFact,"");
  assert.equal(result.director.hiddenNote,"Preserve only this private ledger note.");
  assert.equal(result.director.dangerChange,0);
  assert.equal(result.director.adventureComplete,false);
  assert.equal(result.director.locationName,"");
  assert.deepEqual(result.director.inventoryChanges,[{operation:"add",itemName:"Brass token",quantity:1,status:"carried",note:"Found on the desk."}]);
  assert.ok(result.rejected.includes("model-authored danger change"));
  assert.ok(result.rejected.includes("model-authored adventure completion"));
  assert.ok(result.rejected.includes("model-authored private revelation"));
  assert.ok(result.rejected.includes("model-authored unnamed location"));
});

test("structured guidance can never leak into player narration", () => {
  const leaked = 'The purses are visible. Guidance":[{"label":"Steal one","text":"Take it","type":"act"}] }';
  assert.equal(safeNarrationText(leaked, ["No unattended portable item is established here."]), "No unattended portable item is established here.");
  assert.equal(safeNarrationText("The door remains closed.", []), "The door remains closed.");
});

test("AI inventory quantities cannot exceed the amount explicitly requested", () => {
  const base={publicFacts:["Three silver arrows are transferred to Dad."],privateFact:"",hiddenNote:"",dangerChange:0,adventureComplete:false,locationName:"",locationNote:"",requiredCheck:"",checkReason:"",inventoryChanges:[{operation:"add",itemName:"Silver arrows",quantity:50,status:"stored",note:"Recovered."}]};
  assert.equal(sanitizeDirectorConsequences(base,"take 3 silver arrows").director.inventoryChanges[0].quantity,3);
  assert.equal(sanitizeDirectorConsequences(base,"take one silver arrow").director.inventoryChanges[0].quantity,1);
  assert.deepEqual(sanitizeDirectorConsequences(base,"inspect the three silver arrows").director.inventoryChanges,[]);
  assert.deepEqual(sanitizeDirectorConsequences(base,"take the gold coins").director.inventoryChanges,[]);
});

test("AI-requested checks require a bounded DC and a valid ability-skill pairing", () => {
  const player={name:"Dad",level:5,abilities:{wisdom:14,intelligence:10},skills:["Perception"]};
  const valid=directorCheckRequest(player,"listen at the door",{requiredCheck:"Wisdom (Perception) DC 14",checkReason:"Hear movement on the other side."});
  assert.deepEqual({ability:valid.ability,skill:valid.skill,modifier:valid.modifier,dc:valid.dc},{ability:"Wisdom",skill:"Perception",modifier:5,dc:14});
  assert.equal(directorCheckRequest(player,"listen",{requiredCheck:"Intelligence (Perception) DC 14",checkReason:"Wrong ability."}),null);
  assert.equal(directorCheckRequest(player,"listen",{requiredCheck:"Wisdom (Forbidden Lore) DC 14",checkReason:"Unknown skill."}),null);
  assert.equal(directorCheckRequest(player,"listen",{requiredCheck:"Wisdom (Perception) DC 40",checkReason:"Unbounded DC."}),null);
  assert.equal(directorCheckRequest(player,"listen",{requiredCheck:"Wisdom (Perception) DC 14",checkReason:""}),null);
  assert.equal(directorCheckRequest(player,"listen",{requiredCheck:"make some kind of check",checkReason:"Vague."}),null);
});

test("resolved rolls cannot request another roll or add failed-check consequences", () => {
  const raw={publicFacts:["The attempt fails."],privateFact:"A secret appears.",hiddenNote:"",dangerChange:2,adventureComplete:true,locationName:"New Chamber",locationNote:"Invented",requiredCheck:"Strength (Athletics) DC 12",checkReason:"Try again.",inventoryChanges:[{operation:"add",itemName:"Gem",quantity:1,status:"carried",note:"Invented"}]};
  const result=sanitizeDirectorConsequences(raw,"take the gem",{checkResolved:true,allowInventory:false,allowLocation:false,authoritativeFact:"Dad fails to move the obstacle; it remains in place."});
  assert.equal(result.director.requiredCheck,"");
  assert.equal(result.director.checkReason,"");
  assert.equal(result.director.locationName,"");
  assert.deepEqual(result.director.inventoryChanges,[]);
  assert.deepEqual(result.director.publicFacts,["Dad fails to move the obstacle; it remains in place."]);
  assert.ok(result.rejected.includes("repeat check after resolved roll"));
  assert.ok(result.rejected.includes("location change without successful movement"));
  assert.ok(result.rejected.includes("model-authored check outcome replaced by rules result"));
});
import { beginCombatPotion, beginCombatSpell, combatView, resetWorkshopCombat, resolveCombatRoll, startWorkshopCombat, workshopOptions } from "../server/combat.mjs";

function fixture() {
  const folder = mkdtempSync(join(tmpdir(), "hearthbound-"));
  const db = createDatabase(join(folder, "test.sqlite"));
  return { folder, db, close() { db.close(); rmSync(folder, { recursive: true, force: true }); } };
}

test("Cotton is a divine scaled companion without becoming a selectable player or spotlight member", () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const dad=createPlayer(item.db,{partyId:party.id,name:"Dad",species:"Human",className:"Fighter"});
    const cotton=cottonForParty(item.db,party.id);
    assert.equal(cotton.id,COTTON_ID);
    assert.equal(cotton.name,"Cotton");
    assert.equal(cotton.fullName,COTTON_FULL_NAME);
    assert.equal(cotton.level,1);
    assert.equal(cotton.divine,true);
    assert.match(cotton.appearance,/blue-eyed/i);
    assert.equal(isCottonInteraction("pick up Cotton"),true);
    assert.equal(isCottonInteraction("tickle the cat"),true);
    assert.equal(isCottonInteraction("pick up the lantern"),false);
    assert.equal(buildLobby(item.db).worlds[0].parties[0].characters.some((member)=>member.id===COTTON_ID),false);
    assert.equal(getPartySpotlight(item.db,party.id).playerId,dad.id);
    startWorkshopCombat(item.db,getPlayer(item.db,dad.id),"ogre-veteran","party");
    const view=combatView(item.db,getPlayer(item.db,dad.id));
    assert.equal(view.order.some((member)=>member.id===COTTON_ID && member.type==="companion"),true);
  } finally { item.close(); }
});

test("sealed-letter AI context excludes every future clue", () => {
  const prepared = prepareCampaignContext({ id: "world-hearthbound-lantern-below" }, { dangerClock: 0 }, "pick up the letter and look at it");
  const context = JSON.stringify(prepared.state).toLowerCase();
  assert.equal(prepared.nextClueStage, 0);
  for (const forbidden of ["mara", "ink-mite", "pantry", "cellar", "map", "burn", "bait"]) assert.equal(context.includes(forbidden), false, `sealed context leaked ${forbidden}`);
});

test("inspecting the sealed letter is resolved by rules without spoilers", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId: party.id, name: "Dad", species: "Human", className: "Fighter" });
    setPartyState(item.db, party.id, "dm", { ...getPartyState(item.db, party.id, "dm"), lanternArrivalStage:2, currentLocationKey:"back-room" });
    const action = "pick up the letter and look at it";
    addEvent(item.db, { partyId: party.id, visibility: "public", playerId: player.id, kind: "action", speaker: player.name, text: `attempts: ${action}` });
    const result = await resolveAction(item.db, player, "act", action);
    const narration = listVisibleEvents(item.db, player).filter((event) => event.kind === "narration").at(-1).text.toLowerCase();
    assert.equal(result.source, "rules");
    assert.equal(listInventory(item.db, player.id).some((item) => item.name === "Silver-moth letter"), false);
    for (const forbidden of ["mara", "ink-mite", "pantry", "cellar", "map", "burn", "bait", "magic", "glow"]) assert.equal(narration.includes(forbidden), false, `inspection leaked ${forbidden}`);
    const torchAction = "hold the letter up to a light source like a torch";
    addEvent(item.db, { partyId: party.id, visibility: "public", playerId: player.id, kind: "action", speaker: player.name, text: `attempts: ${torchAction}` });
    const torchResult = await resolveAction(item.db, player, "act", torchAction);
    const visible = listVisibleEvents(item.db, player);
    const torchNarration = visible.filter((event) => event.kind === "narration").at(-1).text.toLowerCase();
    assert.equal(torchResult.source, "rules");
    assert.equal(visible.some((event) => event.visibility === "player"), false);
    for (const forbidden of ["mara", "ink-mite", "pantry", "cellar", "map", "stair", "warm", "heat", "energy", "magic", "glow"]) assert.equal(torchNarration.includes(forbidden), false, `torch inspection leaked ${forbidden}`);
  } finally { item.close(); }
});

test("finding puzzle supplies does not automatically use them", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter" });
    setPartyState(item.db, party.id, "dm", { ...getPartyState(item.db, party.id, "dm"), clueStage:1 });
    const action = "find ink and light / heat sources in the room";
    assert.equal(prepareCampaignContext({ id:party.activeAdventureId }, { clueStage:1 }, action).nextClueStage, 1);
    const result = await resolveAction(item.db, player, "act", action);
    const narration = listVisibleEvents(item.db, player).filter((event)=>event.kind==="narration").at(-1).text.toLowerCase();
    assert.equal(result.source, "rules");
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 1);
    assert.match(narration, /inkwell/);
    assert.match(narration, /only located|remain unchanged/);
    assert.doesNotMatch(narration, /begins to draw|pantry shelves/);
  } finally { item.close(); }
});

test("warming the silver moth does not spend ink or invent an unstored map route", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Barbarian"});
    setPartyState(item.db,party.id,"dm",{
      ...getPartyState(item.db,party.id,"dm"),
      lanternArrivalStage:2,
      clueStage:1,
      currentLocationKey:"back-room",
    });

    await resolveAction(item.db,player,"act","warm the silver moth on the torch");
    let state=getPartyState(item.db,party.id,"dm");
    let narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.equal(state.clueStage,1);
    assert.equal(state.miteAwake,true);
    assert.match(narration,/uncurls and stirs/i);
    assert.match(narration,/inkwell remains untouched/i);
    assert.doesNotMatch(narration,/draws? a route|pantry shelves/i);

    await resolveAction(item.db,player,"act","offer the awakened ink-mite one drop of fresh ink on the paper");
    state=getPartyState(item.db,party.id,"dm");
    narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.equal(state.clueStage,2);
    assert.match(narration,/draw/i);
    assert.match(narration,/pantry shelves/i);

    await resolveAction(item.db,player,"act","investigate the line to the pantry shelves");
    narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.match(narration,/studies the ink-mite's line/i);
    assert.match(narration,/elsewhere in the inn/i);
    assert.doesNotMatch(narration,/not present/i);
    assert.equal(getPartyState(item.db,party.id,"dm").currentLocationKey,"back-room");
  } finally { item.close(); }
});
test("investigating the routed pantry shelves reveals the established cellar door", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter" });
    setPartyState(item.db, party.id, "dm", { ...getPartyState(item.db, party.id, "dm"), clueStage:2, currentLocationKey:"pantry" });
    const action = "investigate shelves";
    assert.equal(prepareCampaignContext({ id:party.activeAdventureId }, { clueStage:2, currentLocationKey:"pantry" }, action).nextClueStage, 3);
    const result = await resolveAction(item.db, player, "act", action);
    const narration = listVisibleEvents(item.db, player).filter((event)=>event.kind==="narration").at(-1).text.toLowerCase();
    assert.equal(result.source, "rules");
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 3);
    assert.match(narration, /concealed cellar door/);
    assert.doesNotMatch(narration, /jar|unidentifiable substance/);
  } finally { item.close(); }
});

test("inventory persists starting gear, quantities, and adventure pickups", () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Kit", species:"Human", className:"Fighter" });
    let inventory = listInventory(item.db, player.id);
    assert.equal(inventory.some((entry) => entry.name === "Chain mail" && entry.status === "equipped"), true);
    assert.equal(inventory.find((entry) => entry.name === "Javelin")?.quantity, 8);
    addInventoryItem(item.db, player.id, { name:"Torch", quantity:1, sourceAdventureId:party.activeAdventureId });
    addInventoryItem(item.db, player.id, { name:"Torch", quantity:1, sourceAdventureId:party.activeAdventureId });
    assert.equal(listInventory(item.db, player.id).find((entry) => entry.name === "Torch")?.quantity, 2);
    removeInventoryItem(item.db, player.id, "Torch", 1);
    assert.equal(listInventory(item.db, player.id).find((entry) => entry.name === "Torch")?.quantity, 1);
    resetPartyStory(item.db, party.id);
    inventory = listInventory(item.db, player.id);
    assert.equal(inventory.some((entry) => entry.name === "Torch"), false);
    assert.equal(inventory.some((entry) => entry.name === "Chain mail"), true);
  } finally { item.close(); }
});

test("requested checks wait for a d20 and resolve with the character modifier", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter", abilities:{ strength:15, dexterity:13, constitution:14, intelligence:8, wisdom:12, charisma:10 }, skills:["Athletics","Acrobatics"] });
    const dmState = getPartyState(item.db, party.id, "dm");
    setPartyState(item.db, party.id, "dm", { ...dmState, clueStage:5 });
    const result = await resolveAction(item.db, player, "ask", "can I do a perception check?");
    assert.equal(result.source, "rules");
    const pending = getPartyState(item.db, party.id, `pendingCheck:${player.id}`);
    assert.equal(pending.skill, "Perception");
    assert.equal(pending.modifier, 1);
    assert.equal(pending.dc, 12);
    const beforeRoll = listVisibleEvents(item.db, player).at(-1).text.toLowerCase();
    assert.equal(beforeRoll.includes("aura"), false);
    const resolved = await resolvePendingCheck(item.db, player, 11);
    assert.equal(resolved.total, 12);
    assert.equal(resolved.success, true);
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 6);
    assert.equal(getPartyState(item.db, party.id, `pendingCheck:${player.id}`), null);
    const guidance = getPlayerGuidance(item.db, player.id, party.id);
    assert.equal(guidance.some((suggestion) => suggestion.label === "Operate the mechanism"), true);
    assert.equal(JSON.stringify(guidance).toLowerCase().includes("mara is trapped"), false);
  } finally { item.close(); }
});

test("Ask DM cannot perform an action or change the world", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter" });
    const dmState = getPartyState(item.db, party.id, "dm");
    setPartyState(item.db, party.id, "dm", { ...dmState, clueStage:6, dangerClock:2 });
    const inventoryBefore = JSON.stringify(listInventory(item.db, player.id));
    const dmEventsBefore = listRecentEventsForDm(item.db, party.id).filter((event) => event.visibility === "dm").length;
    const result = await resolveAction(item.db, player, "ask", "rotate further");
    const stateAfter = getPartyState(item.db, party.id, "dm");
    const events = listRecentEventsForDm(item.db, party.id);
    assert.equal(result.source, "rules");
    assert.equal(stateAfter.clueStage, 6);
    assert.equal(stateAfter.dangerClock, 2);
    assert.equal(JSON.stringify(listInventory(item.db, player.id)), inventoryBefore);
    assert.equal(events.filter((event) => event.visibility === "dm").length, dmEventsBefore);
    assert.match(events.at(-1).text, /action rather than a rules question/i);
    assert.match(events.at(-1).text, /switch to Act/i);
  } finally { item.close(); }
});

test("actively checking the lantern seam for traps requests a roll", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter", abilities:{ strength:15, dexterity:13, constitution:14, intelligence:8, wisdom:12, charisma:10 }, skills:["Athletics","Acrobatics"] });
    const dmState = getPartyState(item.db, party.id, "dm");
    setPartyState(item.db, party.id, "dm", { ...dmState, clueStage:6 });
    const result = await resolveAction(item.db, player, "act", "check for traps near the seam");
    const pending = getPartyState(item.db, party.id, `pendingCheck:${player.id}`);
    assert.equal(result.source, "rules");
    assert.equal(pending.ability, "Wisdom");
    assert.equal(pending.skill, "Perception");
    assert.equal(pending.modifier, 1);
    assert.equal(pending.dc, 12);
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 6);
    assert.match(listVisibleEvents(item.db, player).at(-1).text, /Make a Wisdom \(Perception\) check/i);

    await resolvePendingCheck(item.db, player, 12);
    setPartyState(item.db, party.id, "dm", { ...getPartyState(item.db, party.id, "dm"), clueStage:7 });
    await resolveAction(item.db, player, "act", "inspect the seam for hidden triggers");
    assert.equal(getPartyState(item.db, party.id, `pendingCheck:${player.id}`).skill, "Investigation");
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 7);
  } finally { item.close(); }
});

test("trap searches use the same Perception rule outside authored encounters", async () => {
  const item = fixture();
  try {
    const world = buildLobby(item.db).worlds[0];
    const party = world.parties[0];
    const otherAdventure = world.adventures.find((adventure) => adventure.id.endsWith("ashes-briarwatch"));
    selectAdventure(item.db, party.id, otherAdventure.id);
    const player = createPlayer(item.db, { partyId:party.id, name:"Scout", species:"Human", className:"Fighter", abilities:{ strength:15, dexterity:13, constitution:14, intelligence:8, wisdom:12, charisma:10 }, skills:["Athletics","Acrobatics"] });
    const result = await resolveAction(item.db, player, "act", "search for traps along the stair");
    const pending = getPartyState(item.db, party.id, `pendingCheck:${player.id}`);
    assert.equal(result.source, "rules");
    assert.equal(pending.ability, "Wisdom");
    assert.equal(pending.skill, "Perception");
    assert.equal(pending.generalRule, "trap-search");
    assert.match(pending.successText, /finds no visible tripwire/i);
    assert.doesNotMatch(pending.successText, /reveals every normally visible warning sign/i);
    assert.match(listVisibleEvents(item.db, player).at(-1).text, /Wisdom \(Perception\)/i);
    assert.doesNotMatch(listVisibleEvents(item.db, player).at(-1).text, /finds no visible traps/i);
  } finally { item.close(); }
});

test("forcing obstacles uses the same Athletics rule outside authored encounters", async () => {
  const item = fixture();
  try {
    const world = buildLobby(item.db).worlds[0];
    const party = world.parties[0];
    const otherAdventure = world.adventures.find((adventure) => adventure.id.endsWith("ashes-briarwatch"));
    selectAdventure(item.db, party.id, otherAdventure.id);
    const player = createPlayer(item.db, { partyId:party.id, name:"Strong", species:"Human", className:"Fighter", abilities:{ strength:15, dexterity:13, constitution:14, intelligence:8, wisdom:12, charisma:10 }, skills:["Athletics","Acrobatics"] });
    const result = await resolveAction(item.db, player, "act", "use strength to force the heavy stone door open");
    const pending = getPartyState(item.db, party.id, `pendingCheck:${player.id}`);
    assert.equal(result.source, "rules");
    assert.equal(pending.ability, "Strength");
    assert.equal(pending.skill, "Athletics");
    assert.equal(pending.modifier, 4);
    assert.equal(pending.generalRule, "force-obstacle");
    assert.match(listVisibleEvents(item.db, player).at(-1).text, /Strength \(Athletics\)/i);
  } finally { item.close(); }
});

test("a matching carried key unlocks a door and a later open action changes its state", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    let player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter" });
    addInventoryItem(item.db, player.id, { name:"Key", quantity:1, notes:"Found in the chamber.", sourceAdventureId:party.activeAdventureId });
    addEvent(item.db, { partyId:party.id, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:"The small iron key appears to be the correct size and shape to fit the rusted lock on the stone door." });
    player = getPlayer(item.db, player.id);

    let result = await resolveAction(item.db, player, "act", "use key on doo");
    let interaction = getPartyState(item.db, party.id, `interactions:${party.activeAdventureId}`).keyedDoor;
    assert.equal(result.source, "rules");
    assert.equal(interaction.unlocked, true);
    assert.equal(interaction.open, false);
    assert.match(listVisibleEvents(item.db, player).at(-1).text, /unlocked but still closed/i);

    result = await resolveAction(item.db, getPlayer(item.db, player.id), "act", "open door");
    interaction = getPartyState(item.db, party.id, `interactions:${party.activeAdventureId}`).keyedDoor;
    assert.equal(result.source, "rules");
    assert.equal(interaction.open, true);
    assert.match(listVisibleEvents(item.db, player).at(-1).text, /unlocked and open/i);

    await resolveAction(item.db, getPlayer(item.db, player.id), "act", "open door");
    assert.match(listVisibleEvents(item.db, player).at(-1).text, /already open/i);
    assert.equal(listInventory(item.db, player.id).some((item) => item.name === "Key"), true);
  } finally { item.close(); }
});

test("keyed doors use the same persistent interaction state in another adventure", async () => {
  const item=fixture();
  try {
    const world=buildLobby(item.db).worlds[0];
    const party=world.parties[0];
    const ashes=world.adventures.find((adventure)=>adventure.id.endsWith("ashes-briarwatch"));
    selectAdventure(item.db,party.id,ashes.id);
    let player=createPlayer(item.db,{partyId:party.id,name:"Scout",species:"Human",className:"Rogue"});
    addInventoryItem(item.db,player.id,{name:"Watchtower key",quantity:1,notes:"Fits the iron gate.",sourceAdventureId:ashes.id});
    addEvent(item.db,{partyId:party.id,visibility:"public",kind:"narration",speaker:"Dungeon Master",text:"The watchtower key fits the iron lock on the gate."});
    player=getPlayer(item.db,player.id);
    await resolveAction(item.db,player,"act","use the watchtower key to unlock and open the gate");
    await resolveAction(item.db,getPlayer(item.db,player.id),"act","walk through the gate");
    const interaction=getPartyState(item.db,party.id,`interactions:${ashes.id}`).keyedDoor;
    assert.equal(interaction.unlocked,true);
    assert.equal(interaction.open,true);
    assert.equal(getPartyState(item.db,party.id,"dm").clueStage,undefined);
    assert.match(listVisibleEvents(item.db,player).at(-1).text,/crosses the threshold|enters the passage/i);
  } finally { item.close(); }
});

test("crossing a keyed Lantern door advances the authoritative route instead of returning to the ink-mite", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    let player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter" });
    setPartyState(item.db, party.id, "dm", { ...getPartyState(item.db, party.id, "dm"), clueStage:2 });
    addInventoryItem(item.db, player.id, { name:"Key", quantity:1, notes:"Found in the chamber.", sourceAdventureId:party.activeAdventureId });
    addEvent(item.db, { partyId:party.id, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:"The iron key fits the rusted lock on the cellar door." });
    player = getPlayer(item.db, player.id);

    await resolveAction(item.db, player, "act", "use key to unlock the door");
    const result = await resolveAction(item.db, getPlayer(item.db, player.id), "act", "go through the door");
    const narration = listVisibleEvents(item.db, player).at(-1).text;
    assert.equal(result.source, "rules");
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 4);
    assert.match(narration, /crosses the threshold|enters the passage/i);
    assert.doesNotMatch(narration, /ink-mite.*pantry/i);
  } finally { item.close(); }
});

test("accepted Lantern door entry repairs older saves whose clue stage did not advance", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter" });
    setPartyState(item.db, party.id, "dm", { ...getPartyState(item.db, party.id, "dm"), clueStage:2 });
    setPartyState(item.db, party.id, `interactions:${party.activeAdventureId}`, { keyedDoor:{ unlocked:true, open:false, unlockedBy:player.id } });
    addEvent(item.db, { partyId:party.id, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:"Dad steps through the door into a narrow, damp passage." });

    const result = await resolveAction(item.db, player, "act", "go deeper into the passage");
    const narration = listVisibleEvents(item.db, player).at(-1).text;
    assert.equal(result.source, "rules");
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 4);
    assert.match(narration, /has not returned to the pantry/i);
    assert.doesNotMatch(narration, /must search the shelves/i);
  } finally { item.close(); }
});

test("Lantern clue state rejects travel into an AI-invented passage", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter" });
    setPartyState(item.db, party.id, "dm", { ...getPartyState(item.db, party.id, "dm"), clueStage:1 });
    addEvent(item.db, { partyId:party.id, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:"An earlier faulty narration claimed that a passage stretched into pulsing darkness." });
    const result = await resolveAction(item.db, player, "act", "go deeper into the passage");
    const narration = listVisibleEvents(item.db, player).at(-1).text;
    assert.equal(result.source, "rules");
    assert.match(narration, /No passage has been revealed/i);
    assert.match(narration, /warmed.*fresh ink/i);
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 1);
  } finally { item.close(); }
});

test("movement narration cannot extend an undefined corridor indefinitely", () => {
  const vague = "Dad moves deeper into the passage. The metallic scent grows stronger and the darkness ahead seems to pulse as if something is just beyond sight.";
  const corrected = ensureConcreteMovementResult("Dad", "go deeper into the passage", { publicFacts:[], locationName:"" }, vague);
  assert.doesNotMatch(corrected, /grows stronger/i);
  assert.match(corrected, /No doorway, junction, new chamber, or farther accessible section/i);
  const arrival = "Dad reaches the stone archive at the end of the passage.";
  assert.equal(ensureConcreteMovementResult("Dad", "go deeper", { publicFacts:["Dad reaches the stone archive."], locationName:"Stone Archive" }, arrival), arrival);
});

test("running and following a path cannot be satisfied by more corridor atmosphere", () => {
  const repeated="Dad sprints forward. Another lantern appears farther ahead, the dripping grows louder, and the passage continues deeper into darkness.";
  for(const action of ["run forward to the end of this passage","keep running","follow the path forward"]){
    const corrected=ensureConcreteMovementResult("Dad",action,{publicFacts:["Footprints continue ahead."],locationName:""},repeated);
    assert.match(corrected,/No doorway, junction, new chamber, or farther accessible section is currently established/i);
    assert.doesNotMatch(corrected,/another lantern appears/i);
  }
});

test("unlock and open is completed as one container action", () => {
  const partial="The sealed compartment begins to unlock as the key turns. The lock disengages with a mechanical hiss.";
  const completed=ensureCompleteContainerResult("Dad","open the sealed compartment with the key",partial);
  assert.match(completed,/opens the container fully/i);
  assert.equal(ensureCompleteContainerResult("Dad","unlock the compartment with the key",partial),partial);
  const blocked="The key does not fit, and the box remains locked.";
  assert.equal(ensureCompleteContainerResult("Dad","open the box with the key",blocked),blocked);
});

test("an already-open container cannot be opened a second time", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Dad",species:"Human",className:"Fighter"});
    setPartyState(item.db,party.id,`interactions:${party.activeAdventureId}`,{currentContainer:{open:true,unlocked:true}});
    const result=await resolveAction(item.db,player,"act","open the box");
    const narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.equal(result.source,"rules");
    assert.match(narration,/already open/i);
  } finally { item.close(); }
});

test("where am I uses the persistent map location instead of inventing another corridor", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Dad",species:"Human",className:"Fighter"});
    setPartyState(item.db,party.id,"dm",{...getPartyState(item.db,party.id,"dm"),clueStage:4});
    rememberKnownLocation(item.db,party.id,{name:"The Cellar Passage",summary:"Beyond the unlocked cellar door, an old passage bears Mara Vey's abandoned survey mark."});
    const result=await resolveAction(item.db,player,"act","where am I?");
    const narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.equal(result.source,"rules");
    assert.match(narration,/You are in The Cellar Passage/i);
    assert.match(narration,/latest recorded location/i);
  } finally { item.close(); }
});

test("the same scene object cannot be added to inventory twice", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Dad",species:"Human",className:"Fighter"});
    addInventoryItem(item.db,player.id,{name:"Rusted Key",quantity:1,status:"carried",sourceAdventureId:party.activeAdventureId});
    addEvent(item.db,{partyId:party.id,visibility:"public",playerId:player.id,kind:"system",speaker:"Inventory",text:"Dad added Rusted Key."});
    const result=await resolveAction(item.db,getPlayer(item.db,player.id),"act","take the key");
    const narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.equal(result.source,"rules");
    assert.match(narration,/already picked up/i);
    assert.equal(listInventory(item.db,player.id).find((entry)=>entry.name==="Rusted Key").quantity,1);
  } finally { item.close(); }
});

test("following established Lantern trail wording advances to the next authored place", () => {
  for(const action of ["follow the path forward","run forward to the end of this passage","follow the footprints"]){
    const prepared=prepareCampaignContext({id:"world-hearthbound-lantern-below"},{clueStage:4},action);
    assert.equal(prepared.nextClueStage,5);
  }
});

test("Lantern map only shows locations unlocked by authoritative clue stages", () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    rememberKnownLocation(item.db, party.id, { name:"Invented Pulsing Passage", summary:"A place hallucinated by narration." });
    rememberKnownLocation(item.db, party.id, { name:"The Chamber Below", summary:"Another invented location." });
    assert.deepEqual(getKnownLocations(item.db, party.id).map((location)=>location.name), ["Outside the Crooked Lantern"]);
    setPartyState(item.db, party.id, "dm", { ...getPartyState(item.db, party.id, "dm"), lanternArrivalStage:2, clueStage:3 });
    rememberKnownLocation(item.db, party.id, { name:"The Crooked Lantern cellar", summary:"The legitimate cellar entrance." });
    assert.deepEqual(getKnownLocations(item.db, party.id).map((location)=>location.name), ["Outside the Crooked Lantern","The Crooked Lantern cellar"]);
  } finally { item.close(); }
});

test("a fresh Lantern adventure enters the public inn before the private letter scene", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Dad",species:"Human",className:"Fighter"});
    const opening=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.match(opening,/painted sign|taproom windows/i);
    assert.doesNotMatch(opening,/private room|letter|ink-mite|pantry|cellar/i);

    assert.equal(getPartyState(item.db,party.id,"dm").lanternArrivalStage,0);
    assert.deepEqual(getKnownLocations(item.db,party.id).map((location)=>location.name),["Outside the Crooked Lantern"]);

    const early=await resolveAction(item.db,player,"act","open the mysterious letter");
    assert.equal(early.source,"rules");
    assert.match(listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text,/outside the inn|no mysterious letter/i);
    assert.equal(getPartyState(item.db,party.id,"dm").lanternArrivalStage,0);

    await resolveAction(item.db,player,"act","enter the inn");
    assert.equal(getPartyState(item.db,party.id,"dm").lanternArrivalStage,1);
    assert.match(listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text,/public taproom/i);

    await resolveAction(item.db,player,"speak","ask the innkeeper for a quiet private room");
    assert.equal(getPartyState(item.db,party.id,"dm").lanternArrivalStage,2);
    assert.match(listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text,/private back room|sealed letter/i);
  } finally { item.close(); }
});

test("canonical state stays aligned across taproom questions and private-room entry", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});

    await resolveAction(item.db,player,"act","Look through the taproom windows before going in.");
    await resolveAction(item.db,player,"act","Enter the Crooked Lantern through the public front door.");
    await resolveAction(item.db,player,"act","look around what is there?");
    await resolveAction(item.db,player,"act","is there anything to pickup for my inventory?");
    let narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.match(narration,/no unattended portable item/i);
    assert.doesNotMatch(narration,/mugs|poker|purses|pouches|guidance\s*"?\s*:/i);

    await resolveAction(item.db,player,"act","move to private room");
    let world=getPartyState(item.db,party.id,"world:lantern-below");
    assert.equal(world.currentLocation,"back-room");
    assert.equal(getPartyState(item.db,party.id,"dm").currentLocationKey,"back-room");

    await resolveAction(item.db,player,"act","inspect the letter");
    narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.match(narration,/seal|silver-moth/i);
    assert.doesNotMatch(narration,/not present.*taproom/i);

    await resolveAction(item.db,player,"act","where are we?");
    narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.match(narration,/private back room/i);
    assert.doesNotMatch(narration,/you are in the crooked lantern taproom/i);
  } finally { item.close(); }
});

test("reported Tamsin, table, and compound ink-mite sequence stays grounded end to end", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});
    const latestNarration=()=>listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;

    await resolveAction(item.db,player,"act","Look through the taproom windows before going in.");
    await resolveAction(item.db,player,"act","go inside");
    await resolveAction(item.db,player,"act","what is Tamsin wearing and what colour hair does she have?");
    assert.match(latestNarration(),/iron-grey hair.*dark green wool waistcoat.*brown apron/i);

    await resolveAction(item.db,player,"speak","Ask the innkeeper whether the company can have a quiet private room.");
    await resolveAction(item.db,player,"act","inspect the private table");
    assert.match(latestNarration(),/otherwise bare.*sealed silver-moth letter/i);
    await resolveAction(item.db,player,"act","what is on the private table?");
    assert.match(latestNarration(),/sealed silver-moth letter/i);

    const compound=await resolveAction(item.db,player,"act","open the seal warm it give the ink mite ink");
    assert.equal(compound.rule,"authored-interaction");
    const world=getPartyState(item.db,party.id,"world:lantern-below");
    assert.equal(world.flags.letterOpened,true);
    assert.equal(world.flags.miteAwake,true);
    assert.equal(world.flags.inkOffered,true);
    assert.equal(world.flags.mapDrawn,true);
    assert.match(latestNarration(),/seal breaks.*warmth wakes.*draws a line/is);

    await resolveAction(item.db,player,"act","look at the pantry shelves and the location the path leads");
    assert.match(latestNarration(),/drawing.*pantry shelves elsewhere.*neither places.*nor moves/i);
    assert.equal(getPartyState(item.db,party.id,"world:lantern-below").currentLocation,"back-room");
  } finally { item.close(); }
});

test("natural privacy requests enter and map the authored private room", async () => {
  for (const request of [
    "ask for privacy",
    "ask Tamsin about a private room or a secluded corner",
    "we need a quiet corner",
    "could we have a private room, and could you take us there please?",
  ]) {
    const item=fixture();
    try {
      const party=buildLobby(item.db).worlds[0].parties[0];
      const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});
      await resolveAction(item.db,player,"act","go inside");
      const result=await resolveAction(item.db,player,"speak",request);
      assert.equal(result.rule,"authored-interaction",request);
      assert.equal(getPartyState(item.db,party.id,"world:lantern-below").currentLocation,"back-room",request);
      assert.deepEqual(getKnownLocations(item.db,party.id).map((location)=>location.name),[
        "Outside the Crooked Lantern",
        "The Crooked Lantern Taproom",
        "Private Back Room",
      ],request);
    } finally { item.close(); }
  }
});

test("lead the way accepts the exact recorded NPC escort offer", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});
    await resolveAction(item.db,player,"act","go inside");
    const request=await resolveAction(item.db,player,"speak","is there somewhere private we could sit?");
    assert.equal(request.rule,"npc-conversation");
    assert.equal(getPartyState(item.db,party.id,"world:lantern-below").currentLocation,"inn");
    assert.equal(getPartyState(item.db,party.id,`conversationOffer:lantern-below:${player.id}`)?.interactionId,"request-private-room");

    const acceptance=await resolveAction(item.db,getPlayer(item.db,player.id),"speak","beer please, lead the way to the room");
    assert.equal(acceptance.rule,"authored-interaction");
    assert.equal(getPartyState(item.db,party.id,"world:lantern-below").currentLocation,"back-room");
    assert.equal(getPartyState(item.db,party.id,`conversationOffer:lantern-below:${player.id}`),null);
  } finally { item.close(); }
});

test("an important NPC initiates once when the party first enters their scene", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});
    await resolveAction(item.db,player,"act","go into the tavern");
    let welcomes=listVisibleEvents(item.db,player).filter((event)=>event.payload?.entryBeat==="tamsin-welcome");
    assert.equal(welcomes.length,1);
    assert.equal(welcomes[0].speaker,"Tamsin Reed");
    assert.match(welcomes[0].text,/food, drink, or somewhere quiet/i);
    await resolveAction(item.db,player,"act","go outside");
    await resolveAction(item.db,player,"act","go back into the tavern");
    welcomes=listVisibleEvents(item.db,player).filter((event)=>event.payload?.entryBeat==="tamsin-welcome");
    assert.equal(welcomes.length,1);
  } finally { item.close(); }
});

test("ordinary NPC conversation stays in character without changing canonical story state", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});
    await resolveAction(item.db,player,"act","go inside");
    const before=getPartyState(item.db,party.id,"world:lantern-below");
    const greeting=await resolveAction(item.db,player,"speak","Hello Tamsin, how are you this evening?");
    assert.equal(greeting.rule,"npc-conversation");
    let event=listVisibleEvents(item.db,player).filter((entry)=>entry.kind==="narration").at(-1);
    assert.equal(event.speaker,"Tamsin Reed");
    assert.match(event.text,/evening|what can i do|Tamsin/i);
    const menu=await resolveAction(item.db,player,"speak","What food and drink do you serve?");
    assert.equal(menu.rule,"npc-conversation");
    event=listVisibleEvents(item.db,player).filter((entry)=>entry.kind==="narration").at(-1);
    assert.match(event.text,/stew|bread|beer|cider|roast/i);
    const service=await resolveAction(item.db,player,"speak","could we get some ales around the bar?");
    assert.equal(service.rule,"npc-conversation");
    event=listVisibleEvents(item.db,player).filter((entry)=>entry.kind==="narration").at(-1);
    assert.equal(event.speaker,"Tamsin Reed");
    assert.match(event.text,/stew|bread|beer|cider|roast|ale/i);
    const after=getPartyState(item.db,party.id,"world:lantern-below");
    assert.deepEqual(after,before);
    const memory=getPartyState(item.db,party.id,"npcConversation:lantern-below:tamsin-reed");
    assert.equal(memory.length,3);
    assert.equal(memory[2].speech,"could we get some ales around the bar?");
  } finally { item.close(); }
});

test("human play wording cannot misroute drinks, split story state, or strand the pantry lead", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});
    const latestNarration=()=>listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;

    const enter=await resolveAction(item.db,player,"act","walk into the pub");
    assert.equal(enter.rule,"structured-world-action");
    assert.equal(getPartyState(item.db,party.id,"world:lantern-below").currentLocation,"inn");

    const drinks=await resolveAction(item.db,player,"speak","thank you we would like some drinks what do you have on offer our purse is tight so anything cheap would be good");
    assert.equal(drinks.rule,"npc-conversation");
    assert.equal(getPartyState(item.db,party.id,"world:lantern-below").currentLocation,"inn");

    await resolveAction(item.db,player,"speak","could we have somewhere private to sit please");
    assert.equal(getPartyState(item.db,party.id,"world:lantern-below").currentLocation,"back-room");

    const spokenOpen=await resolveAction(item.db,player,"speak","open the letter and read it");
    assert.equal(spokenOpen.rule,"state-neutral-speech");
    assert.equal(getPartyState(item.db,party.id,"world:lantern-below").flags.letterOpened,false);
    assert.match(latestNarration(),/words do not perform a physical action/i);

    await resolveAction(item.db,player,"act","open the letter and read it");
    const compound=await resolveAction(item.db,player,"act","warm the silver moth and give the ink mite ink");
    assert.equal(compound.rule,"authored-interaction");
    let world=getPartyState(item.db,party.id,"world:lantern-below");
    assert.equal(world.flags.miteAwake,true);
    assert.equal(world.flags.inkOffered,true);
    assert.equal(world.flags.mapDrawn,true);

    const pantry=await resolveAction(item.db,player,"act","walk to pantry shelves and inspect");
    assert.equal(pantry.rule,"authored-interaction");
    world=getPartyState(item.db,party.id,"world:lantern-below");
    assert.equal(world.currentLocation,"pantry");
    assert.equal(world.objects["cellar-hatch"].discovered,true);
    assert.match(latestNarration(),/reaches the pantry|concealed cellar hatch/is);
  } finally { item.close(); }
});

test("natural questions about work and trouble reach the sole present important NPC", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});
    await resolveAction(item.db,player,"act","walk into the inn");
    const before=getPartyState(item.db,party.id,"world:lantern-below");
    for (const speech of [
      "we'd like to understand if there's been any problems recently?",
      "we're looking for work as adventurers",
      "thank you, any work around these parts?",
    ]) {
      const result=await resolveAction(item.db,player,"speak",speech);
      assert.equal(result.rule,"npc-conversation",speech);
      const event=listVisibleEvents(item.db,player).filter((entry)=>entry.kind==="narration").at(-1);
      assert.equal(event.speaker,"Tamsin Reed",speech);
      assert.match(event.text,/contract|unusual|trouble|quieter/i,speech);
    }
    assert.deepEqual(getPartyState(item.db,party.id,"world:lantern-below"),before);
  } finally { item.close(); }
});

test("opened letter instructions can be reread and natural warmth advances the canonical mite state", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});
    const latestNarration=()=>listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    await resolveAction(item.db,player,"act","walk into the inn");
    await resolveAction(item.db,player,"act","ask inn keeper for a private room");
    await resolveAction(item.db,player,"act","open letter");

    const reread=await resolveAction(item.db,player,"act","Carefully read the instructions on the parchment again.");
    assert.equal(reread.rule,"authored-interaction");
    assert.match(latestNarration(),/warm my silver moth.*one drop of fresh ink.*follow the line/i);

    const wording=await resolveAction(item.db,player,"act","what do the instructions say?");
    assert.equal(wording.rule,"authored-interaction");
    assert.match(latestNarration(),/warm my silver moth.*one drop of fresh ink.*follow the line/i);

    const warm=await resolveAction(item.db,player,"act","warm letter");
    assert.equal(warm.rule,"authored-interaction");
    let world=getPartyState(item.db,party.id,"world:lantern-below");
    assert.equal(world.flags.miteAwake,true);
    assert.equal(world.flags.mapDrawn,false);
    assert.match(latestNarration(),/warmth wakes.*ink-mite/i);

    const ink=await resolveAction(item.db,player,"act","apply ink to the ink-mite");
    assert.equal(ink.rule,"authored-interaction");
    world=getPartyState(item.db,party.id,"world:lantern-below");
    assert.equal(world.flags.inkOffered,true);
    assert.equal(world.flags.mapDrawn,true);
    assert.match(latestNarration(),/draws a line.*pantry shelves/i);
  } finally { item.close(); }
});

test("picked-up letter stays usable in the private room and no longer appears sealed on the table", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});
    const latestNarration=()=>listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    await resolveAction(item.db,player,"act","walk into the inn");
    await resolveAction(item.db,player,"act","could we have somewhere private to sit please");

    const pickup=await resolveAction(item.db,player,"act","pickup letter");
    assert.equal(pickup.rule,"structured-world-action");
    assert.match(latestNarration(),/added to the inventory/i);

    await resolveAction(item.db,player,"act","break the seal and read the letter");
    let world=getPartyState(item.db,party.id,"world:lantern-below");
    assert.equal(world.currentLocation,"back-room");
    assert.equal(world.flags.letterOpened,true);
    assert.equal(world.itemOwners["silver-moth-letter"],player.id);

    const reread=await resolveAction(item.db,player,"act","what do the instructions say?");
    assert.equal(reread.rule,"authored-interaction");
    assert.match(latestNarration(),/warm my silver moth.*one drop of fresh ink.*follow the line/i);

    await resolveAction(item.db,player,"act","look around");
    assert.doesNotMatch(latestNarration(),/sealed silver-moth letter/i);
    assert.match(latestNarration(),/small private room/i);
  } finally { item.close(); }
});

test("repeat NPC questions become conversation instead of replaying a plot transition", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});
    await resolveAction(item.db,player,"act","go inside");
    await resolveAction(item.db,player,"speak","ask Tamsin about a private room");
    await resolveAction(item.db,player,"act","return to the taproom");
    const repeated=await resolveAction(item.db,player,"speak","Tamsin, why do you keep private rooms?");
    assert.equal(repeated.rule,"npc-conversation");
    assert.equal(getPartyState(item.db,party.id,"world:lantern-below").currentLocation,"inn");
  } finally { item.close(); }
});

test("Tamsin provides a stored alternate route to the pantry lead", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Dad",species:"Human",className:"Fighter"});

    await resolveAction(item.db,player,"act","enter the inn");
    await resolveAction(item.db,player,"speak","ask Tamsin whether Mara Vey stayed here or expected visitors");
    let state=getPartyState(item.db,party.id,"dm");
    let narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.equal(state.clueStage,0);
    assert.ok(state.storyDiscoveries.includes("mara-stayed-at-inn"));
    assert.match(narration,/eleven days|private back room/i);
    assert.doesNotMatch(narration,/cellar|guardian|witness constellation/i);

    await resolveAction(item.db,player,"speak","ask Tamsin for the private back room");
    await resolveAction(item.db,player,"act","open and read the silver-moth letter");
    await resolveAction(item.db,player,"act","return to the taproom through the private-room door");
    await resolveAction(item.db,player,"speak","show Tamsin Mara's signed note and ask what Mara was investigating");
    state=getPartyState(item.db,party.id,"dm");
    narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.ok(state.storyDiscoveries.includes("pantry-destination"));
    assert.equal(state.pantryLeadSource,"tamsin");
    assert.ok(state.storyDiscoveries.includes("pantry-destination"));
    assert.match(narration,/pantry shelves|draught/i);
    assert.doesNotMatch(narration,/ink-mite.*draw/i);

    const context=prepareCampaignContext({id:party.activeAdventureId},state,"look around").state.unlockedPlayerFacingContext;
    assert.match(context.situation,/Tamsin/i);
    assert.match(context.availableFacts.join(" "),/has not drawn/i);
  } finally { item.close(); }
});

test("the Tamsin route can discover the cellar hatch from physical evidence", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Dad",species:"Human",className:"Rogue"});
    setPartyState(item.db,party.id,"dm",{
      ...getPartyState(item.db,party.id,"dm"),
      lanternArrivalStage:2,
      clueStage:2,
      currentLocationKey:"pantry",
      pantryLeadSource:"tamsin",
      storyDiscoveries:["pantry-destination:tamsin"],
    });
    setPartyState(item.db,party.id,"world:lantern-below",{
      currentLocation:"pantry",
      visited:["outside-inn","inn","kitchen","pantry"],
    });

    await resolveAction(item.db,player,"act","inspect the cold floor-level draught and scrape marks");
    const state=getPartyState(item.db,party.id,"dm");
    const world=getPartyState(item.db,party.id,"world:lantern-below");
    const narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.equal(state.clueStage,3);
    assert.equal(world.objects["cellar-hatch"].discovered,true);
    assert.match(narration,/scrapes|draught/i);
    assert.match(narration,/concealed cellar hatch/i);
    assert.doesNotMatch(narration,/ink-mite's drawn route/i);
  } finally { item.close(); }
});

test("taproom observation and stealth entry cannot create a phantom kitchen scene", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Barbarian"});

    await resolveAction(item.db,player,"act","enter the Crooked Lantern through the public front door");
    assert.equal(getPartyState(item.db,party.id,"dm").currentLocationKey,"inn");
    await resolveAction(item.db,player,"act","look around for the kitchen door");
    let narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.match(narration,/kitchen door is closed/i);
    assert.doesNotMatch(narration,/ajar/i);

    await resolveAction(item.db,player,"act","sneak into the kitchen through the staff kitchen door");
    narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.match(narration,/cannot move directly|party remains/i);
    assert.equal(getPartyState(item.db,party.id,"dm").currentLocationKey,"inn");

    await resolveAction(item.db,player,"act","is there a letter in the room?");
    narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.match(narration,/(?:no letter matching|silver-moth letter is not present).*taproom/i);

    await resolveAction(item.db,player,"act","search the cluttered counter");
    narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text;
    assert.match(narration,/no feature matching/i);
    assert.doesNotMatch(narration,/silver-moth|sealed letter|lavender/i);
    assert.equal(getPartyState(item.db,party.id,"dm").currentLocationKey,"inn");
  } finally { item.close(); }
});

test("Lantern route guesses stay sealed until discovery reaches structured navigation state", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter" });
    setPartyState(item.db, party.id, "dm", {
      ...getPartyState(item.db, party.id, "dm"),
      lanternArrivalStage:2,
      clueStage:2,
      currentLocationKey:"pantry",
    });

    await resolveAction(item.db, player, "act", "open the concealed cellar hatch");
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 2);
    assert.match(listVisibleEvents(item.db, player).at(-1).text, /no revealed route|no stair or passage is visible/i);

    await resolveAction(item.db, player, "act", "search the pantry shelves where the route ends");
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 3);

    await resolveAction(item.db, player, "act", "open the concealed cellar hatch");
    const worldState = getPartyState(item.db, party.id, "world:lantern-below");
    assert.deepEqual(worldState.objects["cellar-hatch"], {
      discovered:true,
      locked:false,
      open:true,
    });
    assert.equal(worldState.currentLocation, "pantry");

    await resolveAction(item.db, player, "act", "descend to the cellar");
    assert.equal(getPartyState(item.db, party.id, "dm").currentLocationKey, "cellar");
    assert.equal(getPartyState(item.db, party.id, "world:lantern-below").currentLocation, "cellar");

    await resolveAction(item.db, player, "act", "take the cellar key");
    await resolveAction(item.db, player, "act", "use the cellar key on the stone door");
    await resolveAction(item.db, player, "act", "go through the stone door");
    assert.equal(getPartyState(item.db, party.id, "dm").currentLocationKey, "cellar-passage");

    await resolveAction(item.db, player, "act", "close the stone door");
    await resolveAction(item.db, player, "act", "take the map");
    assert.deepEqual(getPartyState(item.db, party.id, "world:lantern-below").objects["keyed-stone-door"], {
      locked:false,
      open:false,
    });
  } finally {
    item.close();
  }
});

test("schema-v2 cellar authority requires the carried key and keeps door guidance traversable", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Fighter"});
    setPartyState(item.db,party.id,"world:lantern-below",{
      schemaVersion:2,revision:8,currentLocation:"cellar",previousLocation:"pantry",
      visited:["outside-inn","inn","back-room","kitchen","pantry","cellar"],
      flags:{letterOpened:true,miteAwake:true,mapDrawn:true},
      objects:{"cellar-hatch":{discovered:true,locked:false,open:true},"keyed-stone-door":{locked:true,open:false}},
    });
    setPartyState(item.db,party.id,"dm",{...getPartyState(item.db,party.id,"dm"),clueStage:4,currentLocationKey:"cellar"});

    await resolveAction(item.db,player,"act","use key in lock");
    let world=getPartyState(item.db,party.id,"world:lantern-below");
    assert.deepEqual(world.objects["keyed-stone-door"],{locked:true,open:false});
    assert.match(listVisibleEvents(item.db,player).at(-1).text,/matching key is required/i);

    addInventoryItem(item.db,player.id,{name:"Cellar key",quantity:1,status:"carried",origin:"adventure",sourceAdventureId:"world-hearthbound-lantern-below"});
    await resolveAction(item.db,getPlayer(item.db,player.id),"act","use key in lock");
    await resolveAction(item.db,getPlayer(item.db,player.id),"act","open door");
    assert.match(listVisibleEvents(item.db,player).at(-1).text,/already open/i);
    await resolveAction(item.db,getPlayer(item.db,player.id),"act","go to The Cellar Passage through the stone door");
    world=getPartyState(item.db,party.id,"world:lantern-below");
    assert.equal(world.currentLocation,"cellar-passage");
  } finally { item.close(); }
});
test("Briarwatch rejects locations from another adventure and non-adjacent jumps", () => {
  const item=fixture();
  try{
    const world=buildLobby(item.db).worlds[0],party=world.parties[0];
    const ashes=world.adventures.find((adventure)=>adventure.id.endsWith("ashes-briarwatch"));
    selectAdventure(item.db,party.id,ashes.id);
    rememberKnownLocation(item.db,party.id,{name:"The Crooked Lantern",summary:"This belongs to the previous adventure."});
    rememberKnownLocation(item.db,party.id,{name:"Passage Beyond the Barrier",summary:"An AI-invented shortcut."});
    assert.deepEqual(getKnownLocations(item.db,party.id).map((location)=>location.name),["The Briarwatch Road"]);
    assert.equal(locationTransitionIsAllowed(ashes.id,{clueStage:0},"The Briarwatch Road","The Crooked Lantern"),false);
    assert.equal(locationTransitionIsAllowed(ashes.id,{clueStage:6},"The Briarwatch Road","Cinder Vault"),false);
  }finally{item.close();}
});

test("Briarwatch travel advances through connected authored places one step at a time", async () => {
  const item=fixture();
  try{
    const world=buildLobby(item.db).worlds[0],party=world.parties[0];
    const ashes=world.adventures.find((adventure)=>adventure.id.endsWith("ashes-briarwatch"));
    selectAdventure(item.db,party.id,ashes.id);
    let player=createPlayer(item.db,{partyId:party.id,name:"Dad",species:"Human",className:"Fighter"});
    let result=await resolveAction(item.db,player,"act","continue along the road beyond the broken barrier");
    assert.equal(result.source,"rules");
    assert.equal(getPartyState(item.db,party.id,"dm").clueStage,1);
    assert.deepEqual(getKnownLocations(item.db,party.id).map((location)=>location.name),["The Briarwatch Road","Road Beyond the Barrier"]);
    player=getPlayer(item.db,player.id);
    result=await resolveAction(item.db,player,"act","continue along the road to Briarwatch");
    assert.equal(result.source,"rules");
    assert.equal(getPartyState(item.db,party.id,"dm").clueStage,2);
    assert.equal(getKnownLocations(item.db,party.id).at(-1).name,"Briarwatch East Well");
    assert.equal(getKnownLocations(item.db,party.id).some((location)=>location.name==="The Crooked Lantern"),false);
  }finally{item.close();}
});

test("unresolved movement cannot fall through to AI and invent an authored-map destination", async () => {
  const item=fixture();
  try{
    const world=buildLobby(item.db).worlds[0],party=world.parties[0];
    const ashes=world.adventures.find((adventure)=>adventure.id.endsWith("ashes-briarwatch"));
    selectAdventure(item.db,party.id,ashes.id);
    const player=createPlayer(item.db,{partyId:party.id,name:"Dad",species:"Human",className:"Fighter"});
    const before=getPartyState(item.db,party.id,"dm");

    assert.equal(unresolvedAuthoredMovementResult(player.name,ashes,before,"speak","go deeper"),null);
    assert.equal(unresolvedAuthoredMovementResult(player.name,ashes,before,"act","inspect the road"),null);

    const result=await resolveAction(item.db,player,"act","go deeper into the fog");
    const after=getPartyState(item.db,party.id,"dm");
    const visible=listVisibleEvents(item.db,player).at(-1).text;
    const ledger=listRecentEventsForDm(item.db,party.id,10).find((event)=>event.visibility==="dm" && /Rejected unresolved movement/.test(event.text));

    assert.equal(result.source,"rules");
    assert.deepEqual(after,before);
    assert.match(visible,/remains in The Briarwatch Road/i);
    assert.match(visible,/no farther revealed destination/i);
    assert.ok(ledger);
    assert.deepEqual(getKnownLocations(item.db,party.id).map((location)=>location.name),["The Briarwatch Road"]);
  }finally{item.close();}
});

test("Ask DM explains possible abilities without operating the scene", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter" });
    const dmState = getPartyState(item.db, party.id, "dm");
    setPartyState(item.db, party.id, "dm", { ...dmState, clueStage:6 });
    await resolveAction(item.db, player, "ask", "any dexterity?");
    const answer = listVisibleEvents(item.db, player).at(-1).text;
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 6);
    assert.match(answer, /Dexterity/i);
    assert.match(answer, /Investigation/i);
    assert.match(answer, /Perception/i);
  } finally { item.close(); }
});

test("rescuing Mara requests Athletics and completes only after a successful roll", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter", abilities:{ strength:15, dexterity:13, constitution:14, intelligence:8, wisdom:12, charisma:10 }, skills:["Athletics","Acrobatics"] });
    setPartyState(item.db, party.id, "dm", { ...getPartyState(item.db, party.id, "dm"), clueStage:9 });
    const result = await resolveAction(item.db, player, "act", "use my Strength to clear the stones safely");
    const pending = getPartyState(item.db, party.id, `pendingCheck:${player.id}`);
    assert.equal(result.source, "rules");
    assert.equal(pending.skill, "Athletics");
    assert.equal(pending.modifier, 4);
    assert.equal(pending.dc, 12);
    assert.equal(getPlayerGuidance(item.db, player.id, party.id).length, 0);
    const resolved = await resolvePendingCheck(item.db, player, 8);
    assert.equal(resolved.success, true);
    assert.equal(getPlayerGuidance(item.db, player.id, party.id).length, 0);
  } finally { item.close(); }
});

test("unsupported conjuration and playful speech do not invent scene facts", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Norbert", species:"Gnome", className:"Fighter" });
    setPartyState(item.db, party.id, "dm", { ...getPartyState(item.db, party.id, "dm"), clueStage:9 });
    await resolveAction(item.db, player, "act", "I magically make a thesaurus appear");
    await resolveAction(item.db, player, "speak", "I'm a gnome cat love");
    const recent = listVisibleEvents(item.db, player).slice(-2).map((event)=>event.text.toLowerCase()).join(" ");
    assert.match(recent, /nothing appears/);
    for (const invented of ["rune", "shimmer", "tremble", "cat", "bard"]) assert.equal(recent.includes(invented), false, `invented ${invented}`);
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 9);
  } finally { item.close(); }
});

test("ink guardian combat uses initiative, attack rolls, damage, and hidden enemy statistics", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter", abilities:{ strength:15, dexterity:13, constitution:14, intelligence:8, wisdom:12, charisma:10 }, skills:["Athletics","Acrobatics"] });
    const dmState = getPartyState(item.db, party.id, "dm");
    setPartyState(item.db, party.id, "dm", { ...dmState, clueStage:8 });
    const started = await resolveAction(item.db, player, "act", "attack the creature");
    let view = combatView(item.db, getPlayer(item.db, player.id));
    assert.equal(started.combat, true);
    assert.equal(view.active, true);
    assert.equal(view.pendingRoll.kind, "attack");
    assert.equal(view.pendingRoll.weaponName, "Greatsword");
    assert.equal(view.pendingRoll.attackBonus, 4);
    assert.equal(JSON.stringify(view).includes('"ac"'), false);
    assert.equal(JSON.stringify(view).includes('"hp"'), false);

    const attack = resolveCombatRoll(item.db, getPlayer(item.db, player.id), 20, 20);
    assert.equal(attack.hit, true);
    assert.equal(attack.critical, true);
    view = combatView(item.db, getPlayer(item.db, player.id));
    assert.equal(view.pendingRoll.kind, "damage");
    assert.equal(view.pendingRoll.diceCount, 4);
    assert.equal(view.pendingRoll.dieSides, 6);

    const damage = resolveCombatRoll(item.db, getPlayer(item.db, player.id), 6, 6);
    assert.equal(damage.kind, "damage");
    view = combatView(item.db, getPlayer(item.db, player.id));
    assert.equal(view.active, false);
    assert.equal(view.outcome, "victory");
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 9);
  } finally { item.close(); }
});

test("Combat Workshop isolates history and resets disposable fights", () => {
  const item = fixture();
  try {
    const lobby = buildLobby(item.db);
    const party = lobby.worlds[0].parties[0];
    const lanternId = lobby.worlds[0].adventures.find((adventure) => adventure.title === "The Lantern Below").id;
    const workshopId = lobby.worlds[0].adventures.find((adventure) => adventure.title.includes("Combat Workshop")).id;
    const dad = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter" });
    createPlayer(item.db, { partyId:party.id, name:"Mage", species:"Elf", className:"Wizard" });
    setPartyState(item.db, party.id, "dm", { ...getPartyState(item.db, party.id, "dm"), clueStage:8 });
    setPlayerHp(item.db, dad.id, 5);
    addEvent(item.db, { partyId:party.id, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:"LANTERN-HISTORY" });

    selectAdventure(item.db, party.id, workshopId);
    assert.equal(listVisibleEvents(item.db, dad).some((event) => event.text.includes("LANTERN-HISTORY")), false);
    assert.equal(workshopOptions().length, 4);
    startWorkshopCombat(item.db, dad, "training-dummy", "solo");
    const combat = getPartyState(item.db, party.id, "combat");
    assert.equal(combat.active, true);
    assert.equal(combat.order.filter((entry) => entry.type === "player").length, 1);
    setPlayerHp(item.db, dad.id, 1);
    resetWorkshopCombat(item.db, dad);
    assert.equal(getPartyState(item.db, party.id, "combat"), null);
    assert.equal(getPlayer(item.db, dad.id).hp, getPlayer(item.db, dad.id).maxHp);

    selectAdventure(item.db, party.id, lanternId);
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 8);
    assert.equal(listVisibleEvents(item.db, dad).some((event) => event.text.includes("LANTERN-HISTORY")), true);
    assert.equal(listVisibleEvents(item.db, dad).some((event) => event.text.includes("Test fight begins")), false);
    assert.equal(getPlayer(item.db, dad.id).hp, 5);
  } finally { item.close(); }
});

test("wizard combat spells consume slots while cantrips do not, and potions heal", () => {
  const item = fixture();
  try {
    const lobby = buildLobby(item.db);
    const party = lobby.worlds[0].parties[0];
    const workshopId = lobby.worlds[0].adventures.find((adventure) => adventure.title.includes("Combat Workshop")).id;
    const wizard = createPlayer(item.db, { partyId:party.id, name:"Nigel", species:"Human", className:"Wizard", abilities:{ strength:8,dexterity:13,constitution:14,intelligence:15,wisdom:12,charisma:10 } });
    selectAdventure(item.db, party.id, workshopId);
    startWorkshopCombat(item.db, getPlayer(item.db, wizard.id), "training-dummy", "solo");
    let spellView = combatView(item.db, getPlayer(item.db, wizard.id));
    const initialMissile = spellView.spells.find((spell) => spell.name === "Magic Missile");
    const initialCantrip = spellView.spells.find((spell) => spell.name === "Ray of Frost");
    assert.deepEqual([initialMissile.castsRemaining, initialMissile.castsMaximum], [2, 2]);
    assert.deepEqual([initialCantrip.castsRemaining, initialCantrip.castsMaximum], [null, null]);
    assert.equal(beginCombatSpell(item.db, getPlayer(item.db, wizard.id), "Magic Missile") !== null, true);
    assert.equal(getPlayer(item.db, wizard.id).spellcasting.slots[1].current, 1);
    assert.equal(combatView(item.db, getPlayer(item.db, wizard.id)).pendingRoll.kind, "damage");
    resolveCombatRoll(item.db, getPlayer(item.db, wizard.id), 4, 1);
    spellView = combatView(item.db, getPlayer(item.db, wizard.id));
    assert.equal(spellView.spells.find((spell) => spell.name === "Magic Missile").castsRemaining, 1);
    assert.equal(beginCombatSpell(item.db, getPlayer(item.db, wizard.id), "Ray of Frost") !== null, true);
    assert.equal(getPlayer(item.db, wizard.id).spellcasting.slots[1].current, 1);
    resolveCombatRoll(item.db, getPlayer(item.db, wizard.id), 20, 1);
    setPlayerHp(item.db, wizard.id, 2);
    assert.equal(beginCombatPotion(item.db, getPlayer(item.db, wizard.id)) !== null, true);
    const healed = resolveCombatRoll(item.db, getPlayer(item.db, wizard.id), 4, 4);
    assert.equal(healed.kind, "healing");
    assert.equal(getPlayer(item.db, wizard.id).hp > 2, true);
  } finally { item.close(); }
});

test("characters can move between groups without carrying party membership", () => {
  const item = fixture();
  try {
    const lobby = buildLobby(item.db);
    const world = lobby.worlds[0];
    const first = world.parties[0];
    const testers = createParty(item.db, { worldId:world.id, name:"Combat Testers" });
    const wizard = createPlayer(item.db, { partyId:first.id, name:"Nigel", species:"Human", className:"Wizard" });
    const moved = movePlayerToParty(item.db, wizard.id, testers.id);
    assert.equal(moved.partyId, testers.id);
    assert.equal(buildLobby(item.db).worlds[0].parties.find((party)=>party.id===first.id).characters.some((player)=>player.id===wizard.id), false);
  } finally { item.close(); }
});

test("Combat Workshop wizard level-up applies HP, slots, expertise, and chosen spells", () => {
  const item = fixture();
  try {
    const lobby=buildLobby(item.db); const world=lobby.worlds[0]; const party=world.parties[0];
    const workshop=world.adventures.find((adventure)=>adventure.title.includes("Combat Workshop"));
    const wizard=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Wizard",abilities:{strength:8,dexterity:13,constitution:14,intelligence:15,wisdom:12,charisma:10},skills:["Arcana","Investigation"]});
    selectAdventure(item.db,party.id,workshop.id);
    const options=getLevelUpOptions(item.db,wizard.id);
    assert.equal(options.availableSpells.every((spell)=>Boolean(spell.description)),true);
    assert.equal(Boolean(options.spellSummaries["Acid Splash"]),true);
    const chosen=options.availableSpells.slice(0,2).map((spell)=>spell.name);
    const prepared=[...options.currentPrepared,chosen[0]].slice(0,options.preparedCount);
    const leveled=levelUpPlayer(item.db,wizard.id,{newSpells:chosen,prepared,expertise:"Arcana"});
    assert.equal(leveled.level,2);
    assert.equal(leveled.maxHp,wizard.maxHp+6);
    assert.equal(leveled.spellcasting.slots[1].max,3);
    assert.deepEqual(leveled.expertise,["Arcana"]);
    assert.equal(leveled.spellcasting.spellbook.includes(chosen[0]),true);
  } finally { item.close(); }
});

test("Combat Workshop Warlock level-up applies Pact Magic, invocations, HP, and a new spell", () => {
  const item=fixture();
  try {
    const lobby=buildLobby(item.db); const world=lobby.worlds[0]; const party=world.parties[0];
    const workshop=world.adventures.find((adventure)=>adventure.title.includes("Combat Workshop"));
    const warlock=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Warlock",abilities:{strength:8,dexterity:13,constitution:14,intelligence:10,wisdom:12,charisma:15},skills:["Deception","Investigation"]});
    selectAdventure(item.db,party.id,workshop.id);
    const options=getLevelUpOptions(item.db,warlock.id);
    assert.equal(options.className,"Warlock"); assert.equal(options.nextLevel,2); assert.equal(options.newSpellCount,1); assert.equal(options.invocationCount,3);
    assert.equal(options.availableSpells.every((spell)=>Boolean(spell.description)&&!spell.description.toLowerCase().includes("consult")),true);
    assert.deepEqual(options.nextSlots,[{level:1,count:2,label:"Pact slots"}]);
    const leveled=levelUpPlayer(item.db,warlock.id,{newSpells:[options.availableSpells[0].name],invocations:["Pact of the Tome",options.invocationChoices[0].name,options.invocationChoices[1].name]});
    assert.equal(leveled.level,2); assert.deepEqual(leveled.spellcasting.slots[1],{current:2,max:2}); assert.equal(leveled.spellcasting.prepared.length,3); assert.equal(leveled.spellcasting.invocations.length,3);
  } finally { item.close(); }
});

test("level 5 Eldritch Blast uses two beams and Agonizing Blast adds Charisma damage", () => {
  const item=fixture();
  try {
    const world=buildLobby(item.db).worlds[0],party=world.parties[0],workshop=world.adventures.find((adventure)=>adventure.title.includes("Combat Workshop"));
    let warlock=createPlayer(item.db,{partyId:party.id,name:"Nigel",species:"Human",className:"Warlock",abilities:{strength:8,dexterity:13,constitution:14,intelligence:10,wisdom:12,charisma:15}}); selectAdventure(item.db,party.id,workshop.id);
    while(warlock.level<5){const options=getLevelUpOptions(item.db,warlock.id);const invocations=[...options.currentInvocations,...options.invocationChoices.map((item)=>item.name)].slice(0,options.invocationCount);warlock=levelUpPlayer(item.db,warlock.id,{newSpells:[options.availableSpells[0].name],invocations,subclass:options.subclassChoices[0],ability:"charisma",newCantrip:options.availableCantrips[0]});}
    startWorkshopCombat(item.db,warlock,"ogre-veteran","solo");
    beginCombatSpell(item.db,getPlayer(item.db,warlock.id),"Eldritch Blast");
    let combat=getPartyState(item.db,party.id,"combat"); assert.equal(combat.pendingRoll.totalBeams,2); assert.equal(combat.pendingRoll.weapon.damageModifier,3);
    resolveCombatRoll(item.db,getPlayer(item.db,warlock.id),20,20); combat=getPartyState(item.db,party.id,"combat"); assert.equal(combat.pendingRoll.modifier,3);
    resolveCombatRoll(item.db,getPlayer(item.db,warlock.id),10,5); combat=getPartyState(item.db,party.id,"combat"); assert.equal(combat.pendingRoll.kind,"attack"); assert.equal(combat.pendingRoll.beamNumber,2);
  } finally { item.close(); }
});

test("party guidance level persists independently of adventure restarts", () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    assert.equal(getGuidanceMode(item.db, party.id), "guided");
    assert.equal(setGuidanceMode(item.db, party.id, "classic"), "classic");
    resetPartyStory(item.db, party.id);
    assert.equal(getGuidanceMode(item.db, party.id), "classic");
    assert.equal(setGuidanceMode(item.db, party.id, "not-a-mode"), "guided");
  } finally { item.close(); }
});

test("DM notes and other-party events never enter a player view", () => {
  const item = fixture();
  try {
    const lobby = buildLobby(item.db);
    const firstParty = lobby.worlds[0].parties[0];
    const secondParty = createParty(item.db, { worldId: lobby.worlds[0].id, name: "The Night Company" });
    const player = createPlayer(item.db, { partyId: firstParty.id, name: "Elara", species: "Elf", className: "Rogue" });
    addEvent(item.db, { partyId: firstParty.id, visibility: "dm", kind: "system", speaker: "DM Ledger", text: "SECRET-TRAP" });
    addEvent(item.db, { partyId: firstParty.id, visibility: "player", playerId: player.id, kind: "narration", speaker: "Dungeon Master", text: "ELARA-ONLY" });
    addEvent(item.db, { partyId: secondParty.id, visibility: "public", kind: "narration", speaker: "Dungeon Master", text: "OTHER-PARTY" });
    const visible = listVisibleEvents(item.db, player);
    assert.equal(visible.some((event) => event.text.includes("SECRET-TRAP")), false);
    assert.equal(visible.some((event) => event.text === "ELARA-ONLY"), true);
    assert.equal(visible.some((event) => event.text === "OTHER-PARTY"), false);
    const dmHistory = listRecentEventsForDm(item.db, firstParty.id);
    assert.equal(dmHistory.some((event) => event.text.includes("SECRET-TRAP")), true);
    assert.equal(dmHistory.some((event) => event.text === "OTHER-PARTY"), false);
  } finally { item.close(); }
});

test("worlds keep distinct parties, characters, and level-rated adventures", () => {
  const item = fixture();
  try {
    const created = createWorld(item.db, { name: "Sunless Sea", description: "An ocean beneath the earth." });
    const player = createPlayer(item.db, { partyId: created.party.id, name: "Bram", species: "Dwarf", className: "Cleric" });
    const world = buildLobby(item.db).worlds.find((entry) => entry.id === created.id);
    assert.equal(world.parties[0].characters[0].id, player.id);
    assert.deepEqual(world.adventures.map((adventure) => adventure.minLevel), [1, 1, 3, 5]);
  } finally { item.close(); }
});

test("the adventure shelf lists each adventure once when a world has multiple parties", () => {
  const item = fixture();
  try {
    const firstLobby = buildLobby(item.db);
    const world = firstLobby.worlds[0];
    createParty(item.db, { worldId:world.id, name:"Combat Testers" });
    const adventures = buildLobby(item.db).worlds[0].adventures;
    assert.equal(adventures.length, 4);
    assert.equal(new Set(adventures.map((adventure) => adventure.id)).size, adventures.length);
  } finally { item.close(); }
});

test("the adventure shelf presents one spoiler-safe overarching series", () => {
  const item=fixture();
  try{
    const world=buildLobby(item.db).worlds[0];
    assert.equal(world.series.title,"The Hollow Road");
    assert.equal(world.series.premise.includes("Chancellor"),false);
    const story=world.adventures.filter((adventure)=>adventure.seriesId==="the-hollow-road");
    assert.deepEqual(story.map((adventure)=>adventure.episodeNumber),[1,2,3]);
    assert.equal(story.every((adventure)=>Boolean(adventure.seriesHook)),true);
    assert.equal(world.adventures.find((adventure)=>adventure.id.endsWith("combat-workshop")).seriesId,null);
  }finally{item.close();}
});

test("completed episodes carry a discovered connection into the next adventure without exposing the hidden truth", () => {
  const item=fixture();
  try{
    const world=buildLobby(item.db).worlds[0],party=world.parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Thread Tester",species:"Human",className:"Fighter"});
    completeActiveAdventure(item.db,party.id);
    const visible=listVisibleEvents(item.db,player).map((event)=>event.text).join(" ");
    assert.match(visible,/signal mark from Briarwatch/i);
    assert.equal(visible.includes("Chancellor Oris Vale"),false);
    const ashes=world.adventures.find((adventure)=>adventure.id.endsWith("ashes-briarwatch"));
    selectAdventure(item.db,party.id,ashes.id);
    const nextState=getPartyState(item.db,party.id,"dm");
    assert.match(nextState.adventureBible.campaignSeries.priorEstablishedConnections[0],/Briarwatch/i);
    assert.match(nextState.adventureBible.campaignSeries.hiddenTruth,/Chancellor Oris Vale/);
    const nextVisible=listVisibleEvents(item.db,player).map((event)=>event.text).join(" ");
    assert.match(nextVisible,/Previously|signal mark from Briarwatch/i);
    assert.equal(nextVisible.includes("Chancellor Oris Vale"),false);
  }finally{item.close();}
});

test("deleting a character removes that character without deleting the party", () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId: party.id, name: "Mara", species: "Human", className: "Wizard" });
    assert.equal(deletePlayer(item.db, player.id), true);
    assert.equal(getPlayer(item.db, player.id), null);
    assert.ok(buildLobby(item.db).worlds[0].parties.some((entry) => entry.id === party.id));
  } finally { item.close(); }
});

test("completing an adventure queues proper milestone level-ups instead of changing only the level number", () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId: party.id, name: "Mara", species: "Human", className: "Wizard" });
    completeActiveAdventure(item.db, party.id);
    assert.equal(getPlayer(item.db, player.id).level, 1);
    let options=getLevelUpOptions(item.db,player.id);
    assert.equal(options.nextLevel,2);
    const hpIncrease=options.hpIncrease;
    let leveled=levelUpPlayer(item.db,player.id,{newSpells:options.availableSpells.slice(0,2).map((spell)=>spell.name),prepared:[...options.currentPrepared,options.availableSpells[0].name].slice(0,options.preparedCount),expertise:"Arcana"});
    assert.equal(leveled.level,2);
    assert.equal(leveled.maxHp,player.maxHp+hpIncrease);
    options=getLevelUpOptions(item.db,player.id);
    assert.equal(options.nextLevel,3);
    leveled=levelUpPlayer(item.db,player.id,{newSpells:options.availableSpells.slice(0,2).map((spell)=>spell.name),prepared:[...options.currentPrepared,...options.availableSpells.slice(0,2).map((spell)=>spell.name)].slice(0,options.preparedCount),subclass:options.subclassChoices[0]});
    assert.equal(leveled.level,3);
    assert.equal(leveled.subclass,"Evoker");
    assert.equal(getLevelUpOptions(item.db,player.id),null);
    completeActiveAdventure(item.db, party.id);
    assert.equal(getPlayer(item.db, player.id).level, 3);
  } finally { item.close(); }
});

test("completed adventures stay complete and rescued NPCs do not become trapped again", async () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    const player=createPlayer(item.db,{partyId:party.id,name:"Dad",species:"Human",className:"Fighter"});
    completeActiveAdventure(item.db,party.id);
    await resolveAction(item.db,player,"speak","are you okay Mara?");
    const narration=listVisibleEvents(item.db,player).filter((event)=>event.kind==="narration").at(-1).text.toLowerCase();
    assert.equal(narration.includes("i'm all right"),true);
    assert.equal(narration.includes("trapped"),false);
    assert.equal(getPartyState(item.db,party.id,`pendingCheck:${player.id}`),null);
  } finally { item.close(); }
});

test("traditional character details persist and determine first-level hit points", () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId: party.id, name: "Ilyra", species: "Elf", className: "Wizard", background: "Sage", alignment: "Neutral Good", abilities: { strength:8, dexterity:14, constitution:13, intelligence:15, wisdom:12, charisma:10 }, skills: ["Arcana","History"], equipmentChoice: "recommended", backstory: "A travelling scholar." });
    const saved = getPlayer(item.db, player.id);
    assert.equal(saved.background, "Sage");
    assert.deepEqual(saved.skills, ["Arcana","History"]);
    assert.equal(saved.abilities.intelligence, 15);
    assert.equal(saved.maxHp, 7);
    assert.equal("pronouns" in saved, false);
  } finally { item.close(); }
});

test("test reset clears story and map discoveries but preserves characters", () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId: party.id, name: "Orin", species: "Human", className: "Fighter" });
    addEvent(item.db, { partyId: party.id, visibility: "public", playerId: player.id, kind: "action", speaker: player.name, text: "TEST-ACTION" });
    addEvent(item.db, { partyId: party.id, visibility: "player", playerId: player.id, kind: "narration", speaker: "Dungeon Master", text: "TEST-PRIVATE" });
    rememberKnownLocation(item.db, party.id, { name: "Test Cellar", summary: "A temporary test location." });
    setPartyState(item.db, party.id, "world:lantern-below", { currentLocation:"alcove", visited:["outside-inn","alcove"], objects:{ "spindle-door":{ open:true } } });
    setPartyState(item.db, party.id, `interactions:${party.activeAdventureId}`, { keyedDoor:{ unlocked:true, open:true } });
    setPartyState(item.db, party.id, "world:unrelated-adventure", { preserved:true });
    setPartyState(item.db, party.id, `turnTraces:${party.activeAdventureId}`, [{ id:"test-trace" }]);
    setPartyState(item.db, party.id, `turnRevision:${party.activeAdventureId}`, 7);
    resetPartyStory(item.db, party.id);
    const visible = listVisibleEvents(item.db, player);
    assert.equal(visible.some((event) => event.text.includes("TEST-")), false);
    assert.equal(visible.length, 1);
    assert.equal(getKnownLocations(item.db, party.id).some((location) => location.name === "Test Cellar"), false);
    assert.equal(getPartyState(item.db, party.id, `turnTraces:${party.activeAdventureId}`), null);
    assert.equal(getPartyState(item.db, party.id, `turnRevision:${party.activeAdventureId}`), null);
    assert.equal(getPartyState(item.db, party.id, "world:lantern-below"), null);
    assert.equal(getPartyState(item.db, party.id, `interactions:${party.activeAdventureId}`), null);
    assert.deepEqual(getPartyState(item.db, party.id, "world:unrelated-adventure"), { preserved:true });
    assert.equal(getPlayer(item.db, player.id).name, "Orin");
  } finally { item.close(); }
});

test("party spotlight advances in character order and ignores out-of-turn passes", () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const first = createPlayer(item.db, { partyId: party.id, name: "First", species: "Human", className: "Fighter" });
    const second = createPlayer(item.db, { partyId: party.id, name: "Second", species: "Elf", className: "Wizard" });
    assert.equal(getPartySpotlight(item.db, party.id).playerId, first.id);
    assert.equal(advancePartySpotlight(item.db, party.id, second.id).playerId, first.id);
    assert.equal(advancePartySpotlight(item.db, party.id, first.id).playerId, second.id);
    assert.equal(advancePartySpotlight(item.db, party.id, second.id).playerId, first.id);
  } finally { item.close(); }
});

test("sorcerer can advance through level 5 with 2024 resources", () => {
  const item=fixture();
  try {
    const lobby=buildLobby(item.db); const world=lobby.worlds[0]; const party=world.parties[0]; const workshop=world.adventures.find((entry)=>entry.id.endsWith("combat-workshop"));
    let sorcerer=createPlayer(item.db,{partyId:party.id,name:"Sorcerer Test",species:"Human",className:"Sorcerer",abilities:{strength:8,dexterity:13,constitution:14,intelligence:10,wisdom:12,charisma:15},skills:["Arcana","Persuasion"]}); selectAdventure(item.db,party.id,workshop.id);
    for (const nextLevel of [2,3,4,5]) {
      const options=getLevelUpOptions(item.db,sorcerer.id); assert.equal(options.nextLevel,nextLevel);
      const newSpells=options.availableSpells.slice(0,options.newSpellCount).map((spell)=>spell.name);
      const metamagic=[...options.currentInvocations,...options.invocationChoices.slice(0,Math.max(0,options.invocationCount-options.currentInvocations.length)).map((choice)=>choice.name)];
      sorcerer=levelUpPlayer(item.db,sorcerer.id,{newSpells,prepared:[...options.currentPrepared,...newSpells],invocations:metamagic,subclass:options.subclassChoices[0],ability:"charisma",newCantrip:options.availableCantrips[0]});
    }
    assert.equal(sorcerer.level,5); assert.equal(sorcerer.subclass,"Draconic Sorcery"); assert.equal(sorcerer.abilities.charisma,17);
    assert.deepEqual(sorcerer.spellcasting.sorceryPoints,{current:5,max:5}); assert.equal(sorcerer.spellcasting.slots[3].max,2); assert.equal(sorcerer.spellcasting.metamagic.length,2);
  } finally { item.close(); }
});

test("every 2024 class can advance through level 20 in the Combat Workshop", () => {
  const item=fixture();
  try {
    const world=buildLobby(item.db).worlds[0],party=world.parties[0],workshop=world.adventures.find((entry)=>entry.id.endsWith("combat-workshop"));
    selectAdventure(item.db,party.id,workshop.id);
    const classes=["Barbarian","Bard","Cleric","Druid","Fighter","Monk","Paladin","Ranger","Rogue","Sorcerer","Warlock","Wizard"];
    for(const className of classes){
      let player=createPlayer(item.db,{partyId:party.id,name:`${className} Twenty`,species:"Human",className});
      while(player.level<20){
        const options=getLevelUpOptions(item.db,player.id);
        assert.ok(options,`${className} should have level-up options at level ${player.level}`);
        const newSpells=options.availableSpells.slice(0,options.newSpellCount).map((spell)=>spell.name);
        const updatedSpellbook=[...options.currentSpellbook,...newSpells];
        const invocations=[...options.currentInvocations,...options.invocationChoices.map((choice)=>choice.name)].slice(0,options.invocationCount);
        const ability=Object.entries(options.currentAbilities).find(([,score])=>Number(score)<=18)?.[0];
        player=levelUpPlayer(item.db,player.id,{newSpells,prepared:updatedSpellbook.slice(0,options.preparedCount),invocations,newCantrip:options.availableCantrips[0],expertise:options.expertiseChoices[0],subclass:options.subclassChoices[0],ability});
      }
      assert.equal(player.level,20,`${className} should reach level 20`);
      assert.equal(getLevelUpOptions(item.db,player.id),null,`${className} should stop at level 20`);
      assert.equal(player.classFeatures.some((feature)=>feature.level===20),true,`${className} should record its level-20 feature`);
    }
  } finally { item.close(); }
});

test("level 20 spell resources use the class progression tables", () => {
  const item=fixture();
  try {
    const world=buildLobby(item.db).worlds[0],party=world.parties[0],workshop=world.adventures.find((entry)=>entry.id.endsWith("combat-workshop"));
    selectAdventure(item.db,party.id,workshop.id);
    for(const className of ["Sorcerer","Paladin","Warlock"]){
      let player=createPlayer(item.db,{partyId:party.id,name:`${className} Slots`,species:"Human",className});
      while(player.level<20){
        const options=getLevelUpOptions(item.db,player.id);
        const newSpells=options.availableSpells.slice(0,options.newSpellCount).map((spell)=>spell.name);
        const invocations=[...options.currentInvocations,...options.invocationChoices.map((choice)=>choice.name)].slice(0,options.invocationCount);
        const ability=Object.entries(options.currentAbilities).find(([,score])=>Number(score)<=18)?.[0];
        player=levelUpPlayer(item.db,player.id,{newSpells,prepared:[...options.currentPrepared,...newSpells],invocations,newCantrip:options.availableCantrips[0],subclass:options.subclassChoices[0],ability});
      }
      if(className==="Sorcerer"){assert.equal(player.spellcasting.slots[9].max,1);assert.deepEqual(player.spellcasting.sorceryPoints,{current:20,max:20});}
      if(className==="Paladin")assert.equal(player.spellcasting.slots[5].max,2);
      if(className==="Warlock")assert.deepEqual(player.spellcasting.slots[5],{current:4,max:4});
    }
  } finally { item.close(); }
});

test("explicit class skills must match the 2024 class list and count", () => {
  const item=fixture();
  try {
    const party=buildLobby(item.db).worlds[0].parties[0];
    assert.throws(()=>createPlayer(item.db,{partyId:party.id,name:"Invalid",species:"Human",className:"Warlock",skills:["Persuasion"]}),/exactly 2/);
    const valid=createPlayer(item.db,{partyId:party.id,name:"Valid",species:"Human",className:"Warlock",skills:["Arcana","Religion"]});
    assert.deepEqual(valid.skills,["Arcana","Religion"]);
  } finally { item.close(); }
});

test("mothglass navigation persists the opened passage and stays aligned while backtracking", async () => {
  const item = fixture();
  try {
    const party = buildLobby(item.db).worlds[0].parties[0];
    const player = createPlayer(item.db, { partyId:party.id, name:"Dad", species:"Human", className:"Fighter" });
    setPartyState(item.db, party.id, "dm", {
      ...getPartyState(item.db, party.id, "dm"),
      lanternArrivalStage:2,
      clueStage:6,
      currentLocationKey:"mothglass",
    });

    await resolveAction(item.db, player, "act", "open the concealed passage");
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 6);
    assert.match(listVisibleEvents(item.db, player).at(-1).text, /no revealed route/i);

    await resolveAction(item.db, player, "act", "turn the counterweighted lantern");
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 7);
    assert.deepEqual(getPartyState(item.db, party.id, "world:lantern-below").objects["spindle-door"], {
      discovered:true,
      locked:false,
      open:true,
    });

    await resolveAction(item.db, player, "act", "turn the counterweighted lantern again");
    assert.match(listVisibleEvents(item.db, player).at(-1).text, /already open|remains open/i);

    await resolveAction(item.db, player, "act", "go forward into the concealed passage");
    assert.equal(getPartyState(item.db, party.id, "dm").currentLocationKey, "passage");

    await resolveAction(item.db, player, "act", "continue forward");
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 8);
    assert.equal(getPartyState(item.db, party.id, "dm").currentLocationKey, "alcove");
    assert.equal(getPartyState(item.db, party.id, "world:lantern-below").currentLocation, "alcove");

    await resolveAction(item.db, player, "act", "go back");
    assert.equal(getPartyState(item.db, party.id, "dm").clueStage, 8);
    assert.equal(getPartyState(item.db, party.id, "dm").currentLocationKey, "passage");
    assert.equal(getPartyState(item.db, party.id, "world:lantern-below").currentLocation, "passage");
  } finally {
    item.close();
  }
});
