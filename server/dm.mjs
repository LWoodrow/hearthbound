import { addEvent, addInventoryItem, completeActiveAdventure, getActiveAdventure, getGuidanceMode, getKnownLocations, getPartyState, listInventory, listPlayers, listRecentEventsForDm, rememberKnownLocation, removeInventoryItem, setPartyState, setPlayerGuidance } from "./database.mjs";
import { cottonForParty } from "./cotton.mjs";
import { applyAdventureEvent, adventureRules, authoredRouteContext, featureLocationRule, locationRule, locationTransitionIsAllowed } from "./adventure-rules.mjs";
import { handleCombatAction } from "./combat.mjs";
import { adventureDefinition } from "./adventure-registry.mjs";
import { createInitialWorldState, resolveWorldAction } from "./world-state.mjs";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MODEL = process.env.DND_MODEL || "qwen3:14b-q4_K_M";

export async function isOllamaReady() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(900) });
    if (!response.ok) return false;
    const body = await response.json();
    return Array.isArray(body.models) && body.models.some((item) => item.name === MODEL || item.model === MODEL);
  } catch { return false; }
}

async function ollamaChat(messages, schema, generation = {}) {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, stream: false, think: false, format: schema, options: { temperature: generation.temperature ?? 0.62, num_ctx: 8192, num_predict: generation.numPredict ?? 520 } }),
    signal: AbortSignal.timeout(150000),
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const body = await response.json();
  return JSON.parse(body.message.content);
}

const directorSchema = {
  type: "object",
  properties: {
    publicFacts: { type: "array", items: { type: "string" } },
    privateFact: { type: "string" },
    hiddenNote: { type: "string" },
    dangerChange: { type: "integer", minimum: -1, maximum: 2 },
    adventureComplete: { type: "boolean" },
    locationName: { type: "string" },
    locationNote: { type: "string" },
    requiredCheck: { type: "string" },
    checkReason: { type: "string" },
    inventoryChanges: { type: "array", items: { type:"object", properties:{ operation:{type:"string",enum:["add","remove"]}, itemName:{type:"string"}, quantity:{type:"integer",minimum:1,maximum:999}, status:{type:"string",enum:["equipped","carried","stored"]}, note:{type:"string"} }, required:["operation","itemName","quantity","status","note"] } },
  },
  required: ["publicFacts", "privateFact", "hiddenNote", "dangerChange", "adventureComplete", "locationName", "locationNote", "requiredCheck", "checkReason", "inventoryChanges"],
};

const narrationSchema = { type: "object", properties: { narration: { type: "string" }, suggestions:{ type:"array", items:{ type:"object", properties:{ label:{type:"string"}, text:{type:"string"}, mode:{type:"string",enum:["act","speak","ask"]}, reason:{type:"string"} }, required:["label","text","mode","reason"] } } }, required: ["narration","suggestions"] };
const questionSchema = { type: "object", properties: { answer: { type: "string" }, suggestions:{ type:"array", items:{ type:"object", properties:{ label:{type:"string"}, text:{type:"string"}, mode:{type:"string",enum:["act","speak","ask"]}, reason:{type:"string"} }, required:["label","text","mode","reason"] } } }, required: ["answer","suggestions"] };
const characterDetailSchema = { type: "object", properties: { text: { type: "string" } }, required: ["text"] };

const LANTERN_GUIDANCE = [
  [{label:"Examine the seal",text:"Examine the silver-moth seal without opening the letter.",mode:"act",reason:"Careful inspection may establish what is visible without disturbing it."},{label:"Open the letter",text:"Deliberately break the seal and open the letter.",mode:"act",reason:"Opening it is a clear choice, but may have consequences."}],
  [{label:"Find the supplies",text:"Look for fresh ink and a safe source of flame.",mode:"act",reason:"The letter gives explicit instructions for waking what is inside."},{label:"Study the note",text:"Examine the note for any additional visible marks or writing.",mode:"act",reason:"This checks the document without assuming a hidden answer."}],
  [{label:"Follow the drawn route",text:"Follow the ink-mite's drawn route toward the pantry shelves.",mode:"act",reason:"The map now provides a player-visible destination."}],
  [{label:"Check the door",text:"Listen at the concealed cellar door and inspect its frame before opening it.",mode:"act",reason:"This gathers immediate information without entering."},{label:"Enter carefully",text:"Open the concealed door and descend carefully with a light source.",mode:"act",reason:"The party can choose to follow the discovered route."}],
  [{label:"Follow Mara's marks",text:"Follow Mara's survey marks deeper into the old passage.",mode:"act",reason:"The marks are the clearest visible lead."},{label:"Examine the trail",text:"Examine the recent traces around Mara's survey mark.",mode:"act",reason:"A closer look may clarify how she travelled."}],
  [{label:"Perception check",text:"Can I make a Perception check to search the chamber carefully?",mode:"ask",reason:"Perception may notice a subtle visible feature."},{label:"Investigation check",text:"Can I make an Investigation check to work out how this chamber is constructed?",mode:"ask",reason:"Investigation may connect the room's visible clues."},{label:"Examine the lantern",text:"Examine the hanging lantern and its mounting without moving it yet.",mode:"act",reason:"Mara's visible arrow points toward it."}],
  [{label:"Operate the mechanism",text:"Turn the hanging lantern carefully to operate its counterweight.",mode:"act",reason:"The successful check identified how the mechanism works."},{label:"Check the seam",text:"Inspect the wall seam before operating the lantern mechanism.",mode:"act",reason:"This may clarify what will move."}],
  [{label:"Follow the passage",text:"Follow the boot prints and dried ink into the concealed passage.",mode:"act",reason:"Both visible trails lead onward."},{label:"Inspect the tracks",text:"Examine the boot prints and ink streak before entering the passage.",mode:"act",reason:"The tracks may provide useful immediate information."}],
  [{label:"Use the light",text:"Keep the lantern light trained on the ink-dark creature and try to move past it.",mode:"act",reason:"The creature visibly recoils from direct light."},{label:"Assess the collapse",text:"Ask Mara whether the stones are moving before attempting a rescue.",mode:"speak",reason:"Her answer may reveal the immediate risk without exposing hidden information."}],
  [{label:"Clear the stones",text:"Carefully clear the loose stones to free Mara.",mode:"act",reason:"The guardian no longer blocks the rescue."}],
];

const LANTERN_ARRIVAL_GUIDANCE = [
  [{label:"Enter the inn",text:"Enter the Crooked Lantern through the public front door.",mode:"act",reason:"The company is still outside beneath the inn sign."},{label:"Look inside",text:"Look through the taproom windows before going in.",mode:"act",reason:"This establishes what is publicly visible without entering."}],
  [{label:"Ask for privacy",text:"Ask the innkeeper whether the company can have a quiet private room.",mode:"speak",reason:"The party is in the public taproom and has not yet taken a private room."},{label:"Settle in",text:"Find a quiet table where the company can talk privately.",mode:"act",reason:"This moves the party out of the busy public taproom."}],
];

function lanternArrivalStage(dmState) {
  if (Number(dmState?.clueStage || 0) > 0) return 2;
  if (!Object.prototype.hasOwnProperty.call(dmState || {},"lanternArrivalStage")) return 2;
  return Math.max(0,Math.min(2,Number(dmState.lanternArrivalStage || 0)));
}

const ASHES_GUIDANCE = [
  [{label:"Follow the road",text:"Continue along the road beyond the broken barrier.",mode:"act",reason:"This follows the established route toward Briarwatch."}],
  [{label:"Continue to Briarwatch",text:"Follow the road until we reach the first occupied part of Briarwatch.",mode:"act",reason:"This completes the approach without entering an unrelated building."}],
  [{label:"Question the survivors",text:"Ask the survivors at the east well what they saw when the strange fire appeared.",mode:"speak",reason:"The survivors are the first established witnesses."}],
  [{label:"Examine the burn site",text:"Examine the damaged croft and compare where the fire started with the survivors' account.",mode:"act",reason:"This follows the evidence the survivors identified."}],
  [{label:"Follow the scorch angles",text:"Follow the matching scorch angles toward the Briarwatch watchtower.",mode:"act",reason:"The physical evidence now provides an established destination."}],
  [{label:"Inspect the signal room",text:"Enter the watchtower signal room and inspect the old mirrors without moving them yet.",mode:"act",reason:"This examines the established apparatus before operating it."}],
  [{label:"Trace the projection",text:"Work out where the signal mirrors are projecting the unnatural fire from.",mode:"act",reason:"This follows the revealed mechanism toward its source."}],
];

function updateGuidance(db, player, stage, suggestions = null, forceStandard = false) {
  const mode = getGuidanceMode(db, player.partyId);
  if (mode === "classic" || (mode === "standard" && !forceStandard)) return setPlayerGuidance(db, player.id, player.partyId, []);
  return setPlayerGuidance(db, player.id, player.partyId, suggestions || LANTERN_GUIDANCE[Math.max(0, Math.min(9, Number(stage || 0)))] || []);
}

export function refreshPlayerGuidance(db, player) {
  const adventure = getActiveAdventure(db, player.partyId);
  const state = getPartyState(db, player.partyId, "dm") || {};
  if (String(adventure?.id || "").endsWith("ashes-briarwatch")) return setPlayerGuidance(db, player.id, player.partyId, ASHES_GUIDANCE[Math.max(0,Math.min(6,Number(state.clueStage || 0)))] || []);
  if (!String(adventure?.id || "").endsWith("lantern-below")) return setPlayerGuidance(db, player.id, player.partyId, []);
  const arrivalStage=lanternArrivalStage(state);
  if(arrivalStage<2) return updateGuidance(db,player,0,LANTERN_ARRIVAL_GUIDANCE[arrivalStage]);
  return updateGuidance(db, player, Number(state.clueStage || 0));
}

function appearsStalled(history) {
  const actions = history.filter((event) => event.kind === "action").slice(-3).map((event) => event.text.toLowerCase());
  if (actions.length < 2) return false;
  const exploratory = (text) => /\b(search|look|inspect|examine|where|feature|door|item|what)\b/.test(text);
  return exploratory(actions.at(-1)) && exploratory(actions.at(-2));
}

function safeNarratorSuggestions(suggestions) {
  const safeReason = {
    act:"This examines or uses something already visible without assuming the result.",
    speak:"Conversation may provide information the other character can reasonably share.",
    ask:"This checks whether a character skill or rule applies without assuming success.",
  };
  return (Array.isArray(suggestions) ? suggestions : []).map((item) => ({ ...item, reason:safeReason[item?.mode] || safeReason.act }));
}

export function prepareCampaignContext(adventure, dmState, action) {
  if (String(adventure?.id || "").endsWith("ashes-briarwatch")) {
    const currentStage=Math.max(0,Math.min(6,Number(dmState.clueStage || 0)));
    const words=String(action || "").toLowerCase();
    const moves=/\b(go|walk|travel|continue|follow|advance|proceed|head|move|enter|approach)\w*\b/.test(words);
    let nextClueStage=currentStage;
    if(currentStage===0 && moves && /\b(road|barrier|passage|forward|briarwatch)\b/.test(words)) nextClueStage=1;
    else if(currentStage===1 && moves && /\b(road|briarwatch|town|village|forward|end)\b/.test(words)) nextClueStage=2;
    else if(currentStage===2 && /\b(ask|question|interview|speak|talk)\w*\b/.test(words) && /\b(survivor|survivors|people|witness|witnesses|well)\b/.test(words)) nextClueStage=3;
    else if(currentStage===3 && /\b(examine|inspect|investigate|compare|study|search)\w*\b/.test(words) && /\b(burn|fire|croft|site|scorch|damage)\b/.test(words)) nextClueStage=4;
    else if(currentStage===4 && moves && /\b(scorch|angle|trail|watchtower|tower|footprint|footprints)\b/.test(words)) nextClueStage=5;
    else if(currentStage===5 && /\b(enter|inspect|examine|investigate|study)\w*\b/.test(words) && /\b(signal|mirror|mirrors|room|tower|watchtower)\b/.test(words)) nextClueStage=6;
    return {
      nextClueStage,
      state:{
        ...dmState,
        clueStage:nextClueStage,
        authoredRoute:authoredRouteContext(adventure.id,{...dmState,clueStage:nextClueStage}),
        instruction:"Advance at most one Briarwatch clue stage. The Crooked Lantern belongs to the previous adventure and does not exist as a Briarwatch destination.",
      },
    };
  }
  if (!String(adventure?.id || "").endsWith("lantern-below")) {
    return { state:{...dmState,authoredRoute:authoredRouteContext(adventure?.id,dmState)}, nextClueStage: Number(dmState.clueStage || 0) };
  }

  const currentArrivalStage=lanternArrivalStage(dmState);
  if(currentArrivalStage<2){
    const words=String(action || "").toLowerCase();
    const enters=/\b(?:enter|go|walk|step|head|come|open|push)\w*\b/.test(words) && /\b(?:inn|crooked lantern|front door|taproom|inside|building)\b/.test(words);
    const seeksPrivacy=/\b(?:private|quiet|back)\b/.test(words) && /\b(?:room|table|parlour|parlor|space)\b/.test(words);
    let nextLanternArrivalStage=currentArrivalStage;
    if(currentArrivalStage===0 && enters) nextLanternArrivalStage=1;
    else if(currentArrivalStage===1 && seeksPrivacy) nextLanternArrivalStage=2;
    const arrivalContext=currentArrivalStage===0
      ? {situation:"The company stands outside the Crooked Lantern beneath its sign in the rain.",availableFacts:["The public front door is visible.","Warm light, conversation, and supper-smoke spill from the taproom when it opens."],boundary:"The party has not entered the inn. No private back room, mysterious letter, silver-moth seal, ink-mite, cellar, or later location exists in player-facing play yet."}
      : {situation:"The company is inside the Crooked Lantern's busy public taproom.",availableFacts:["The innkeeper and ordinary patrons are present.","Food, drink, and public tables are available."],boundary:"The party has not entered a private back room. No mysterious letter, silver-moth seal, ink-mite, cellar, or later location exists in player-facing play yet."};
    const currentLocationKey=["outside-inn","inn","back-room"][nextLanternArrivalStage];
    const nextState={...dmState,lanternArrivalStage:nextLanternArrivalStage,clueStage:0,currentLocationKey,unlockedPlayerFacingContext:arrivalContext,instruction:"The arrival sequence and current room are authoritative. Resolve only the current exterior, public taproom, or private-room scene; crossing a doorway requires an explicit movement action."};
    return {nextClueStage:0,nextLanternArrivalStage,state:{...nextState,authoredRoute:authoredRouteContext(adventure.id,nextState)}};
  }

  const currentStage = Math.max(0, Math.min(9, Number(dmState.clueStage || 0)));
  const words = String(action || "").toLowerCase();
  const appliesHeat = /\b(?:warm|heat)\w*\s+(?:the\s+)?(?:silver[- ]?moth|moth|seal|wax|letter)\b/.test(words)
    || /\b(?:hold|place|put|use)\w*\b[^.]{0,60}\b(?:flame|fire|hearth|heat|torch|lantern)\b/.test(words);
  const appliesInk = /\b(?:give|feed|offer|apply|put|drop|touch|use)\w*\b[^.]{0,60}\bink\b/.test(words)
    || /\bink\b[^.]{0,30}\b(?:on|onto|to|into)\b/.test(words);
  let nextClueStage = currentStage;
  if (currentStage === 0 && /\b(open|unseal|break|cut|peel|remove)\b/.test(words) && /\b(letter|envelope|seal|wax)\b/.test(words)) nextClueStage = 1;
  else if (currentStage === 1 && appliesHeat && appliesInk) nextClueStage = 2;
  else if (currentStage === 2 && dmState.currentLocationKey === "pantry" && /\b(search|inspect|investigate|examine|move|look)\w*\b/.test(words) && /\b(pantry|shel(?:f|ves))\b/.test(words)) nextClueStage = 3;
  else if (currentStage === 3 && dmState.currentLocationKey === "pantry" && /\b(open|enter|descend|explore|follow|go|push)\w*\b/.test(words) && /\b(door|cellar|stair|below|passage)\b/.test(words)) nextClueStage = 4;
  else if (currentStage === 4 && /\b(follow|explore|continue|search|open|enter|advance|run|sprint|proceed)\w*\b/.test(words) && /\b(mark|trail|footprint|footprints|path|passage|door|chamber|route|forward|end)\b/.test(words)) nextClueStage = 5;
  else if (currentStage === 6 && /\b(turn|rotate|pull|push|move|twist|lower)\w*\b/.test(words) && /\b(lantern|fixture|counterweight|spindle)\b/.test(words)) nextClueStage = 7;
  else if (currentStage === 7 && /\b(follow|enter|explore|continue|go)\w*\b/.test(words) && /\b(hidden|passage|opening|route|way)\b/.test(words)) nextClueStage = 8;

  const unlocked = [
    {
      situation: "An unexplained sealed letter bearing a silver-moth wax seal rests on the party's table in the Crooked Lantern.",
      availableFacts: ["The seal is unbroken.", "The paper is dry despite the rain outside.", "Something beneath the wax made one faint scratch and then became still."],
      boundary: "The sender, contents, purpose, creature, instructions, route, and every later location are unknown and must not be named, hinted at, or inferred.",
    },
    {
      situation: "The party has deliberately opened the silver-moth letter.",
      availableFacts: ["A tiny dormant ink-mite is inside and remains still.", "The signed note reads: To whoever still honours the old road: the way below the lantern is not sealed, only forgotten. Warm my silver moth over a flame, give what wakes inside one drop of fresh ink, and follow the line it draws. Do not let the innkeeper see it. — Mara Vey"],
      boundary: "The destination of any route, the cellar, the pantry, Mara's fate, and what lies below remain unknown.",
    },
    {
      situation: "The party has opened the letter and deliberately used warmth and fresh ink as instructed.",
      availableFacts: ["The ink-mite wakes without hostility and draws a route on the paper.", "The drawn route ends at the pantry shelves."],
      boundary: "No door, stair, passage, survey mark, danger, or explanation of Mara's fate has yet been discovered.",
    },
    {
      situation: "The ink-mite's route led the party to search the pantry shelves.",
      availableFacts: ["The search reveals a concealed cellar door behind the shelves.", "Subtle marks show that the door was used recently."],
      boundary: "The party has not entered. What lies below and who used the door remain unknown.",
    },
    {
      situation: "The party has deliberately entered and explored the cellar.",
      availableFacts: ["A survey mark belonging to Mara is visible below.", "Evidence shows that she entered the old passage."],
      boundary: "Mara's fate and her full discovery remain unknown.",
    },
    {
      situation: "Mara's survey marks lead through a narrow stone door into the mothglass chamber.",
      availableFacts: ["A single ornate brass lantern hangs from the ceiling.", "Thick dust covers the floor, except for a disturbed circle directly beneath the lantern.", "There is no obvious exit, but Mara's final survey arrow points upward toward the hanging lantern."],
      boundary: "The lantern's mechanism, any hidden opening, what waits beyond, and Mara's fate remain unknown until investigated.",
    },
    {
      situation: "A careful Perception or Investigation check has revealed the mothglass chamber's mechanism.",
      availableFacts: ["The hanging lantern is attached to a counterweighted spindle rather than an ordinary hook.", "A narrow vertical seam is visible in the wall behind it.", "The lantern can be turned or pulled without taking it down."],
      boundary: "The mechanism has not yet been operated, so the concealed way and everything beyond it remain unknown.",
    },
    {
      situation: "The party operated the hanging lantern's counterweight and opened a concealed passage.",
      availableFacts: ["A narrow passage opens behind the wall seam.", "Recent boot prints and a streak of dried black ink continue into it.", "The chamber lantern remains fixed to its spindle."],
      boundary: "The destination, any creature, and Mara's condition remain unknown until the party follows the passage.",
    },
    {
      situation: "The party followed the concealed passage to a collapsed survey alcove.",
      availableFacts: ["Mara's voice can be heard alive beyond a fall of loose stone.", "A flat, ink-dark creature moves between the party and the collapse, recoiling from direct lantern light.", "A safe approach requires dealing with or bypassing the creature before shifting the unstable stones."],
      boundary: "Do not decide how the party handles the creature or whether Mara is rescued until the players act and any required check or combat is resolved.",
    },
    {
      situation: "The ink-dark guardian has been overcome or bypassed and the party can reach the collapse.",
      availableFacts: ["Mara is trapped but conscious behind loose stones.", "The remaining rescue requires careful physical work before the passage shifts again."],
      boundary: "Do not declare Mara rescued or the adventure complete until the party clears the collapse successfully.",
    },
  ][nextClueStage];

  return {
    nextClueStage,
    state: {
      ...dmState,
      dangerClock: Number(dmState.dangerClock || 0),
      clueStage: nextClueStage,
      unlockedPlayerFacingContext: unlocked,
      instruction: "Only unlockedPlayerFacingContext exists for this resolution. Its boundary is absolute; do not mention or allude to anything it marks unknown.",
      authoredRoute:authoredRouteContext(adventure.id,{...dmState,clueStage:nextClueStage}),
    },
  };
}

function resolveAuthoritativeClueAction(db, player, adventure, dmState, action, preparedContext) {
  if (!String(adventure?.id || "").endsWith("lantern-below")) return false;
  if (lanternArrivalStage(dmState) < 2) return false;
  const words = String(action || "").toLowerCase();
  const currentStage = Math.max(0, Math.min(9, Number(dmState.clueStage || 0)));
  const nextStage = preparedContext.nextClueStage;
  const mentionsLetter = /\b(letter|envelope|seal|wax)\b/.test(words);
  const relevant = nextStage > currentStage || (currentStage === 0 && mentionsLetter) || (currentStage === 1 && mentionsLetter && /\b(read|inspect|examine|study|check)\w*\b/.test(words));
  if (!relevant) return false;

  const narrationByStage = [
    `${player.name} examines the letter without disturbing its seal. The silver-moth wax remains unbroken, the paper is dry despite the rain outside, and one faint scratch sounds beneath the wax before becoming still. No writing or mark visible on the sealed exterior identifies its sender or explains how it arrived.`,
    `${player.name} deliberately breaks the silver-moth seal and opens the letter. A tiny, motionless ink-mite lies inside beside a signed note: “To whoever still honours the old road: the way below the lantern is not sealed, only forgotten. Warm my silver moth over a flame, give what wakes inside one drop of fresh ink, and follow the line it draws. Do not let the innkeeper see it. — Mara Vey”`,
    `As warmth reaches the silver moth and a drop of fresh ink touches the paper, the tiny ink-mite wakes and begins to draw. Its line crosses the page in a precise route and stops at a clear destination: the pantry shelves. It reveals nothing beyond that point.`,
    `${player.name} searches the pantry shelves where the drawn route ends. Careful pressure shifts one section enough to expose a concealed cellar door behind it; subtle marks around its edge show that someone used it recently. The closed door reveals nothing about what lies below.`,
    `${player.name} descends into the cellar and follows the old passage far enough to find a survey mark belonging to Mara. Nearby traces confirm that she entered the passage, but they do not reveal where she went or what happened to her.`,
    `Following Mara's survey marks, ${player.name} passes through a narrow stone door into a still chamber. A single ornate brass lantern hangs from the ceiling above thick dust, but the dust forms a disturbed circle directly beneath it; Mara's final survey arrow points upward toward the lantern. No ordinary exit is visible.`,
    `${player.name} notices that the hanging lantern is fixed to a counterweighted spindle rather than an ordinary hook. Behind it, a narrow vertical seam divides the stone wall, and the fixture can be turned or pulled without removing the lantern. The mechanism has not yet been operated.`,
    `${player.name} operates the lantern's counterweight. Stone shifts behind the vertical seam, opening a narrow passage where recent boot prints and a streak of dried black ink lead onward; the brass lantern remains attached to its spindle.`,
    `${player.name} follows the concealed passage to a collapsed survey alcove. Mara's voice answers from beyond the loose stones, but an ink-dark, flattened creature slides across the floor between you and the collapse, recoiling whenever the lantern light falls directly upon it. The unstable stones cannot be cleared safely while it blocks the approach.`,
    `With the ink-dark guardian overcome or bypassed, ${player.name} reaches the collapse. Mara is conscious behind the loose stones, but the remaining rubble must be shifted carefully before the damaged passage moves again.`,
  ];
  addEvent(db, { partyId: player.partyId, visibility: "public", kind: "narration", speaker: "Dungeon Master", text: narrationByStage[nextStage] });
  addEvent(db, { partyId: player.partyId, visibility: "dm", kind: "system", speaker: "DM Ledger", text: `Rules engine advanced The Lantern Below clue stage from ${currentStage} to ${nextStage}.` });
  const stageLocations={3:"pantry",4:"cellar-passage",5:"mothglass",6:"mothglass",7:"mothglass",8:"alcove",9:"alcove"};
  setPartyState(db, player.partyId, "dm", { ...dmState, clueStage: nextStage, currentLocationKey:stageLocations[nextStage] || dmState.currentLocationKey || "back-room" });
  updateGuidance(db, player, nextStage);
  if (currentStage === 0 && mentionsLetter && /\b(pick|pickup|take|grab|collect)\w*\b/.test(words)) addInventoryItem(db, player.id, { name:"Silver-moth letter", quantity:1, status:"carried", notes:"A sealed letter found at the Crooked Lantern.", sourceAdventureId:adventure.id });
  if (nextStage === 3) rememberKnownLocation(db, player.partyId, { name: "The Crooked Lantern cellar", summary: "A concealed cellar door lies behind the pantry shelves." });
  if (nextStage === 4) rememberKnownLocation(db, player.partyId, { name:"The Cellar Passage", summary:"An old passage beneath the inn bears Mara Vey's abandoned survey mark." });
  if (nextStage === 5) rememberKnownLocation(db, player.partyId, { name:"The Mothglass Chamber", summary:"A still stone chamber contains an ornate brass lantern and Mara's final upward-pointing survey arrow." });
  if (nextStage === 7) rememberKnownLocation(db, player.partyId, { name:"The Concealed Passage", summary:"Operating the chamber lantern opens a narrow passage marked by recent boot prints and dried black ink." });
  if (nextStage === 8) rememberKnownLocation(db, player.partyId, { name:"Collapsed Survey Alcove", summary:"A collapsed alcove blocks the route to Mara while an ink-dark guardian bars the approach." });
  return true;
}

function resolveLanternArrivalAction(db,player,adventure,dmState,mode,action,preparedContext){
  if(!String(adventure?.id || "").endsWith("lantern-below")) return false;
  const currentStage=lanternArrivalStage(dmState);
  if(currentStage>=2) return false;
  const normalized=String(action || "").trim().toLowerCase();
  const entersInn=/\b(?:enter|go|walk|step|head|move)\b[^.]{0,35}\b(?:inn|taproom|inside|front door)\b|\bopen\b[^.]{0,25}\bfront door\b/i.test(normalized);
  const takesPrivateRoom=/\b(?:ask|request|take|find|enter|go|move|walk|follow)\b[^.]{0,45}\b(?:private|back|quiet)\b[^.]{0,20}\b(?:room|table|place|space)\b|\b(?:private|back) room\b/i.test(normalized);
  const spokenRoomRequest=mode==="speak" && currentStage===1 && takesPrivateRoom;
  if(mode!=="act" && !spokenRoomRequest) return false;
  const nextStage=currentStage===0 && entersInn ? 1 : currentStage===1 && takesPrivateRoom ? 2 : currentStage;
  const mentionsLetter=/\b(?:letter|envelope|silver[- ]?moth|seal|ink[- ]?mite)\b/i.test(normalized);
  if(nextStage<=currentStage && !mentionsLetter) return false;
  let text;
  if(mentionsLetter && nextStage<=currentStage){
    text=currentStage===0
      ? `There is no letter here outside the inn. ${player.name} can see the Crooked Lantern's public front door and warm taproom windows through the rain.`
      : `No mysterious letter is visible in the public taproom. The company is still among the innkeeper and patrons and has not taken a private room.`;
  } else if(nextStage===1){
    text=`${player.name} opens the Crooked Lantern's front door and the company enters its busy public taproom. Firelight catches rain on their cloaks while patrons talk over supper; the innkeeper looks up and asks whether they want food, drink, or a place to sit. No private room has been taken and no mysterious letter is present.`;
    rememberKnownLocation(db,player.partyId,{name:"The Crooked Lantern taproom",summary:"The inn's warm, busy public room, entered from the rain-soaked street."});
  } else {
    text=`The innkeeper leads the company away from the public taproom to a small private back room and closes the door behind them. Only after the party settles in do they notice a sealed letter resting alone on the table, its wax impressed with a silver moth; none of them saw anyone place it there. Beneath the wax, something scratches once—and becomes still.`;
    rememberKnownLocation(db,player.partyId,{name:"The Crooked Lantern back room",summary:"A private room where an unexplained silver-moth letter appeared on the table."});
  }
  const currentLocationKey=["outside-inn","inn","back-room"][nextStage];
  setPartyState(db,player.partyId,"dm",{...dmState,lanternArrivalStage:nextStage,clueStage:0,currentLocationKey});
  addEvent(db,{partyId:player.partyId,visibility:"public",kind:"narration",speaker:"Dungeon Master",text});
  addEvent(db,{partyId:player.partyId,visibility:"dm",kind:"system",speaker:"DM Ledger",text:`Rules engine advanced The Lantern Below arrival from stage ${currentStage} to ${nextStage}.`});
  if(nextStage<2) updateGuidance(db,player,0,LANTERN_ARRIVAL_GUIDANCE[nextStage]);
  else updateGuidance(db,player,0);
  return true;
}

function resolveBriarwatchClueAction(db, player, adventure, dmState, action, preparedContext) {
  if (!String(adventure?.id || "").endsWith("ashes-briarwatch")) return false;
  const currentStage=Math.max(0,Math.min(6,Number(dmState.clueStage || 0)));
  const nextStage=Math.max(currentStage,Math.min(6,Number(preparedContext.nextClueStage || currentStage)));
  if(nextStage<=currentStage) return false;
  const results={
    1:{ location:"Road Beyond the Barrier", text:`${player.name} follows the road through the gap left by the broken barrier. The party remains outdoors on the Briarwatch road; the Crooked Lantern is behind them in the previous adventure, and no building has been entered.` },
    2:{ location:"Briarwatch East Well", text:`The road opens onto Briarwatch's east well, the first occupied stopping place in the settlement. A small group of smoke-stained survivors has gathered here, giving the party a clear chance to ask what happened before choosing where to go next.` },
    3:{ location:"Moonfire Burn Site", text:`The survivors describe flame appearing without consuming the lamp oil and direct the party to a damaged croft nearby. Their account establishes the Moonfire Burn Site as the next place to examine; the party learns its location but has not yet searched it.` },
    4:{ location:"Briarwatch Watchtower", text:`Comparing the damage reveals that the scorch marks share the same unnatural angle and point toward the abandoned Briarwatch watchtower. The evidence establishes the watchtower as the next destination without yet revealing what is inside.` },
    5:{ location:"Watchtower Signal Room", text:`${player.name} reaches the Briarwatch watchtower and enters its signal room. Old signal mirrors stand in their original mountings; they can be inspected here, but nothing beneath the room has yet been revealed.` },
    6:{ location:"Cinder Vault", text:`The signal apparatus reveals that the projected fire originates beneath the signal room. A sealed way into the Cinder Vault is now established, but its occupant and the result of entering remain unresolved until the party acts.` },
  }[nextStage];
  if(!results) return false;
  setPartyState(db,player.partyId,"dm",{...dmState,clueStage:nextStage});
  rememberKnownLocation(db,player.partyId,{name:results.location,summary:locationRule(adventure.id,results.location)?.summary || "A place established by the party's investigation."});
  addEvent(db,{partyId:player.partyId,visibility:"public",kind:"narration",speaker:"Dungeon Master",text:results.text});
  addEvent(db,{partyId:player.partyId,visibility:"dm",kind:"system",speaker:"DM Ledger",text:`Rules engine advanced Ashes of Briarwatch from stage ${currentStage} to ${nextStage}; no intermediate location was skipped.`});
  setPlayerGuidance(db,player.id,player.partyId,ASHES_GUIDANCE[nextStage] || []);
  return true;
}

function validateAuthoredDestination(db, player, adventure, dmState, director) {
  const rules=adventureRules(adventure?.id);
  const proposed=String(director?.locationName || "").trim();
  if(!proposed || !rules.locations.length) return true;
  const currentRule=locationRule(adventure.id,dmState.currentLocationKey);
  const known=getKnownLocations(db,player.partyId);
  const current=currentRule?.label || known.at(-1)?.name || rules.locations[0]?.label;
  if(locationTransitionIsAllowed(adventure.id,dmState,current,proposed)) return true;
  director.locationName="";
  director.locationNote="";
  director.publicFacts=[`The attempted route does not reach a known connected destination from ${current}. The party remains at ${current}; no unrelated building or later area is entered.`];
  director.privateFact="";
  director.adventureComplete=false;
  director.hiddenNote=`Rejected an unknown or non-adjacent location transition from ${current} to ${proposed}.`;
  return false;
}

function resolveLanternSourceSearch(db, player, adventure, dmState, mode, action) {
  if (mode !== "act" || !String(adventure?.id || "").endsWith("lantern-below") || Number(dmState.clueStage || 0) !== 1) return false;
  const words = String(action || "").toLowerCase();
  const searches = /\b(?:find|look|search|locate|check)\w*\b/.test(words);
  const seeksSupplies = /\bink\b/.test(words) && /\b(?:light|heat|flame|fire|hearth|torch|lantern)\b/.test(words);
  if (!searches || !seeksSupplies) return false;
  if((dmState.currentLocationKey || "back-room") !== "back-room") return false;
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`${player.name} finds a small inkwell on the back-room writing desk and a small oil lamp beside it. Both supplies are within reach in this room, but ${player.name} has only located them; the silver-moth letter and its dormant ink-mite remain unchanged.` });
  setPlayerGuidance(db, player.id, player.partyId, [
    { label:"Use the instructions", text:"Warm the silver-moth seal over the oil-lamp flame and offer the ink-mite one drop of fresh ink.", mode:"act", reason:"This deliberately applies the two supplies exactly as the opened note instructs." },
    { label:"Inspect the supplies", text:"Examine the inkwell and hearth without using either on the letter.", mode:"act", reason:"This checks the visible supplies while leaving the letter unchanged." },
  ]);
  return true;
}

function skillModifier(player, ability, skill) {
  const score = Number(player.abilities?.[ability.toLowerCase()] || 10);
  const base = Math.floor((score - 10) / 2);
  const proficient = (player.skills || []).some((item) => String(item).toLowerCase() === skill.toLowerCase());
  const proficiency = proficient ? 2 + Math.floor((Math.max(1, Number(player.level || 1)) - 1) / 4) : 0;
  return base + proficiency;
}

function queueAbilityCheck(db, player, pending) {
  const key = `pendingCheck:${player.id}`;
  if (getPartyState(db, player.partyId, key)) return true;
  setPartyState(db, player.partyId, key, pending);
  setPlayerGuidance(db, player.id, player.partyId, []);
  const sign = pending.modifier >= 0 ? "+" : "";
  addEvent(db, {
    partyId:player.partyId,
    visibility:"public",
    kind:"narration",
    speaker:"Dungeon Master",
    text:`Make a ${pending.ability} (${pending.skill}) check: roll d20 ${sign}${pending.modifier} against DC ${pending.dc}. ${pending.reason}`,
  });
  return true;
}

// Shared adjudication comes before adventure narration. Adventures may supply a
// more specific check first, but ordinary wording must mean the same thing in
// every campaign instead of relying on the model to remember when to ask.
function offerGeneralAbilityCheck(db, player, mode, action) {
  if (mode !== "act") return false;
  const words = String(action || "").trim().toLowerCase();
  if (!words) return false;

  const searches = /\b(check|search|look|inspect|examine|scan|sweep)\w*\b/.test(words);
  const trapSearch = searches && /\b(trap|traps|hazard|hazards|tripwire|pressure plate|pressure plates|ambush|danger|dangers)\b/.test(words);
  if (trapSearch) {
    const ability = "Wisdom";
    const skill = "Perception";
    return queueAbilityCheck(db, player, {
      ability,
      skill,
      modifier:skillModifier(player, ability, skill),
      dc:12,
      reason:"Search the area you can currently see for signs of traps or immediate hazards without assuming it is safe.",
      successText:`${player.name} finds no visible tripwire, pressure plate, concealed trigger, unstable footing, or other physical sign of a trap in the area currently within reach. This result applies only to the searched area and does not detect an unseen magical effect.`,
      failureText:`${player.name} searches for traps, but awkward angles, poor light, or distracting detail prevent a reliable conclusion. No obvious trigger is spotted, but ${player.name} cannot confidently declare the area safe.`,
      generalRule:"trap-search",
      action:String(action || ""),
    });
  }

  const studiesMechanism = searches && /\b(mechanism|mechanisms|lock|locks|hinge|hinges|device|devices|machinery|rune|runes|inscription|inscriptions)\b/.test(words);
  if (studiesMechanism) {
    const ability = "Intelligence";
    const skill = "Investigation";
    return queueAbilityCheck(db, player, {
      ability,
      skill,
      modifier:skillModifier(player, ability, skill),
      dc:12,
      reason:"Study the visible construction and evidence to work out how it functions; this examines it without operating it.",
      successText:`${player.name} finds no movable catch, concealed linkage, or mechanical trigger among the parts currently visible. Whatever the markings mean, this examination does not identify an operable mechanism in the searched area.`,
      failureText:`${player.name} studies the visible construction, but cannot yet form a reliable explanation of how its parts work together. The mechanism remains unchanged.`,
      generalRule:"mechanism-study",
      action:String(action || ""),
    });
  }

  const forcesObstacle = /\b(force|break|bash|shoulder|heave|wrench|pry|shove|push|pull|lift|shift|move|bend)\w*\b/.test(words)
    && /\b(door|doors|gate|gates|portcullis|lock|locks|stone|stones|rock|rocks|rubble|debris|bar|bars|obstacle|obstacles|statue|crate|crates)\b/.test(words);
  if (forcesObstacle) {
    const ability = "Strength";
    const skill = "Athletics";
    return queueAbilityCheck(db, player, {
      ability,
      skill,
      modifier:skillModifier(player, ability, skill),
      dc:/\b(heavy|sealed|stuck|jammed|locked|massive|iron|stone)\b/.test(words) ? 14 : 12,
      reason:"Overcome the obstacle's physical resistance. Failure leaves it in place and may cost time, but does not invent a new consequence.",
      successText:`${player.name} finds firm footing and applies controlled force. The obstacle yields to the attempted movement as far as ordinary physical strength can move it; the action does not bypass a separate magical ward or mechanism that has already been established.`,
      failureText:`${player.name} strains against the obstacle, but it does not yield. It remains in place without creating a new complication.`,
      generalRule:"force-obstacle",
      action:String(action || ""),
    });
  }

  const riskyAthletics = /\b(climb|swim|jump|leap)\w*\b/.test(words)
    && /\b(wall|cliff|ledge|chasm|gap|ravine|current|river|rough water|roof|drop)\b/.test(words);
  if (riskyAthletics) {
    const ability = "Strength";
    const skill = "Athletics";
    return queueAbilityCheck(db, player, {
      ability,
      skill,
      modifier:skillModifier(player, ability, skill),
      dc:12,
      reason:"Complete the demanding movement without losing progress or footing.",
      successText:`${player.name} completes the demanding movement and reaches the intended position.`,
      failureText:`${player.name} cannot complete the movement safely and stops at the last secure position rather than being moved somewhere unintended.`,
      generalRule:"risky-movement",
      action:String(action || ""),
    });
  }

  return false;
}

function resolveKeyedDoorInteraction(db, player, adventure, mode, action, recentHistory) {
  if (mode !== "act") return false;
  const words = String(action || "").trim().toLowerCase();
  const mentionsDoor = /\b(?:door|doo|gate|lock)\w*\b/.test(words);
  if (!mentionsDoor) return false;

  const hasKey = (player.inventory || []).some((item) => Number(item.quantity || 0) > 0 && /\bkey\b/i.test(String(item.name || "")));
  const visibleHistory = (recentHistory || [])
    .filter((event) => event.visibility !== "dm")
    .slice(-18)
    .map((event) => String(event.text || ""))
    .join(" ")
    .toLowerCase();
  const keyWasMatched = /\bkey\b[^.]{0,140}\b(?:fit|fits|fitted|correct size|correct shape)\b[^.]{0,140}\b(?:lock|door)\b/.test(visibleHistory)
    || /\b(?:lock|door)\b[^.]{0,140}\bkey\b[^.]{0,100}\b(?:fit|fits|correct)\b/.test(visibleHistory);
  const interactionKey = `interactions:${adventure?.id || "adventure"}`;
  const interactions = getPartyState(db, player.partyId, interactionKey) || {};
  const door = interactions.keyedDoor || {};
  const explicitlyUsesKey = /\b(?:use|insert|put|try|turn|unlock)\w*\b/.test(words) && /\bkey\b/.test(words);
  const opensDoor = /\bopen\w*\b/.test(words);
  const crossesDoor = /\b(?:go|walk|step|move|enter|pass|proceed)\w*\b[^.]{0,60}\b(?:through|into|past)\b[^.]{0,30}\b(?:door|doorway|gate|portal)\b/.test(words)
    || /\benter\w*\b[^.]{0,30}\b(?:doorway|gateway|portal)\b/.test(words);
  const closesDoor = /\bclose\w*\b/.test(words);
  const applyDoorEvent=(eventName)=>{
    const current=getPartyState(db,player.partyId,"dm") || {};
    const result=applyAdventureEvent(adventure?.id,current,eventName);
    setPartyState(db,player.partyId,"dm",result.state);
    if(result.location) rememberKnownLocation(db,player.partyId,{name:result.location.label,summary:result.location.summary});
  };

  if (closesDoor && door.open) {
    setPartyState(db, player.partyId, interactionKey, { ...interactions, keyedDoor:{ ...door, open:false } });
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`${player.name} closes the door. It is shut but remains unlocked; the key stays in ${player.name}'s possession.` });
    return true;
  }

  if (door.unlocked && crossesDoor) {
    setPartyState(db, player.partyId, interactionKey, { ...interactions, keyedDoor:{ ...door, open:true } });
    applyDoorEvent("keyedDoorCrossed");
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`${player.name} opens the unlocked door, crosses the threshold, and enters the passage beyond. The door remains open behind ${player.name}, and the key stays in ${player.name}'s possession.` });
    return true;
  }

  if (!hasKey || (!explicitlyUsesKey && !opensDoor) || (!keyWasMatched && !door.unlocked)) return false;
  if (opensDoor && door.open) {
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`The door is already open. ${player.name} does not need to open it again and may examine the threshold, look beyond it, or enter.` });
    return true;
  }

  const nextDoor = { unlocked:true, open:Boolean(opensDoor), unlockedBy:player.id };
  setPartyState(db, player.partyId, interactionKey, { ...interactions, keyedDoor:nextDoor });
  if (opensDoor) applyDoorEvent("keyedDoorOpened");
  const text = opensDoor
    ? `${player.name} inserts the matching key, turns it in the lock, and opens the door. The door is now unlocked and open; looking through it or crossing the threshold can reveal what lies beyond.`
    : `${player.name} inserts the matching key and turns it. The lock clicks open; the key remains in ${player.name}'s possession, and the door is now unlocked but still closed.`;
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text });
  return true;
}

const containerWords=/\b(?:box|chest|coffer|container|compartment|cabinet|cupboard|drawer|case|crate)\b/i;

function resolvePersistentContainerInteraction(db, player, adventure, mode, action, recentHistory) {
  if(mode!=="act" || !containerWords.test(String(action||""))) return false;
  const words=String(action||"").toLowerCase();
  const opens=/\bopen\w*\b/.test(words);
  const closes=/\bclose\w*\b/.test(words);
  if(!opens&&!closes) return false;
  const interactionKey=`interactions:${adventure?.id||"adventure"}`;
  const interactions=getPartyState(db,player.partyId,interactionKey)||{};
  const visible=(recentHistory||[]).filter((event)=>event.visibility!=="dm").slice(-24).map((event)=>String(event.text||"")).join(" ");
  const historyOpen=/(?:box|chest|coffer|container|compartment|cabinet|cupboard|drawer|case|crate)[^.]{0,55}(?:is|stands|remains|now) open\b/i.test(visible)
    || /\bopened? (?:the )?(?:box|chest|coffer|container|compartment|cabinet|cupboard|drawer|case|crate)\b/i.test(visible);
  const container={...(interactions.currentContainer||{}),open:Boolean(interactions.currentContainer?.open||historyOpen)};
  if(opens&&container.open){
    setPartyState(db,player.partyId,interactionKey,{...interactions,currentContainer:container});
    addEvent(db,{partyId:player.partyId,visibility:"public",kind:"narration",speaker:"Dungeon Master",text:`The container is already open. ${player.name} can inspect its contents, take a visible item, close it, or leave it alone.`});
    return true;
  }
  if(closes&&container.open){
    setPartyState(db,player.partyId,interactionKey,{...interactions,currentContainer:{...container,open:false}});
    addEvent(db,{partyId:player.partyId,visibility:"public",kind:"narration",speaker:"Dungeon Master",text:`${player.name} closes the container. Its contents remain unchanged.`});
    return true;
  }
  return false;
}

export function ensureCompleteContainerResult(playerName,action,narration){
  const words=String(action||"").toLowerCase();
  if(!containerWords.test(words)||!/\bopen\w*\b/.test(words)) return narration;
  const text=String(narration||"");
  const stopped=/\b(?:cannot|can't|does not|doesn't|fails? to|remains? locked|will not|won't|no keyhole|wrong key|does not fit)\b/i.test(text);
  const actuallyOpen=/(?:box|chest|coffer|container|compartment|cabinet|cupboard|drawer|case|crate)[^.]{0,55}(?:is|now|stands) open\b/i.test(text)
    || /\bopens? (?:the )?(?:box|chest|coffer|container|compartment|cabinet|cupboard|drawer|case|crate)\b/i.test(text);
  if(stopped||actuallyOpen) return text;
  const onlyUnlocked=/\b(?:unlock|lock disengages|lock clicks|begins to unlock|key is inserted|key.*turn)\b/i.test(text);
  return onlyUnlocked?`${text} ${playerName} completes the stated action and opens the container fully; anything visibly inside can now be examined or taken.`:text;
}

function recordContainerInteraction(db,player,adventure,action,narration){
  if(!containerWords.test(String(action||""))||!/\bopen\w*\b/i.test(String(action||""))) return;
  const stopped=/\b(?:cannot|can't|does not|doesn't|fails? to|remains? locked|will not|won't|no keyhole|wrong key|does not fit)\b/i.test(String(narration||""));
  if(stopped)return;
  const interactionKey=`interactions:${adventure?.id||"adventure"}`;
  const interactions=getPartyState(db,player.partyId,interactionKey)||{};
  const usedKey=/\bkey\b/i.test(String(action||""));
  setPartyState(db,player.partyId,interactionKey,{...interactions,currentContainer:{...(interactions.currentContainer||{}),open:true,unlocked:usedKey||interactions.currentContainer?.unlocked}});
}

function actionPhrase(text,phrase){
  const clean=(value)=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  return ` ${clean(text)} `.includes(` ${clean(phrase)} `);
}

function mentionedAuthoredLocation(adventure,action){
  const rules=adventureRules(adventure?.id);
  return rules.locations.find((room)=>[room.key,room.label,room.mapLabel,...(room.names||[])].filter(Boolean).some((name)=>actionPhrase(action,name))) || null;
}

function currentAuthoredLocation(adventure,dmState){
  const rules=adventureRules(adventure?.id);
  let key=dmState?.currentLocationKey;
  if(!key && String(adventure?.id||"").endsWith("lantern-below")){
    const clue=Number(dmState?.clueStage||0);
    const arrival=Number(dmState?.lanternArrivalStage||0);
    key=clue>=8?"alcove":clue>=5?"mothglass":clue>=4?"cellar-passage":clue>=3?"pantry":arrival>=2?"back-room":arrival>=1?"inn":"outside-inn";
  }
  return locationRule(adventure?.id,key) || rules.locations[0] || null;
}

function resolveAuthoredRoomMovement(db,player,adventure,dmState,mode,action){
  if(mode!=="act")return false;
  const words=String(action||"");
  if(!/\b(?:go|walk|move|enter|leave|return|head|step|cross|travel|proceed|follow|climb|descend|ascend)\w*\b/i.test(words))return false;
  const target=mentionedAuthoredLocation(adventure,words);
  if(!target)return false;
  const rules=adventureRules(adventure?.id);
  const current=currentAuthoredLocation(adventure,dmState);
  if(!current)return false;
  if(target.key===current.key){
    addEvent(db,{partyId:player.partyId,visibility:"public",kind:"narration",speaker:"Dungeon Master",text:`${player.name} is already in ${current.label}. Visible here: ${(current.features||[]).join(", ") || "the established surroundings"}.`});
    return true;
  }
  const route=authoredRouteContext(adventure.id,dmState);
  if(!route)return false;
  const revealed=new Set(route.revealedLocations.map((room)=>room.key));
  const connected=(room)=>rules.locations.filter((item)=>room.connectsTo?.includes(item.key)||item.connectsTo?.includes(room.key));
  const exits=connected(current).filter((room)=>revealed.has(room.key));
  if(!revealed.has(target.key) || !locationTransitionIsAllowed(adventure.id,dmState,current.key,target.key)){
    const exitNames=exits.map((room)=>room.label).join(", ") || "no further revealed room";
    addEvent(db,{partyId:player.partyId,visibility:"public",kind:"narration",speaker:"Dungeon Master",text:`${player.name} cannot move directly from ${current.label} to ${target.label}. From here, the revealed exits lead to ${exitNames}; the party remains in ${current.label}.`});
    return true;
  }
  const nextState={...dmState,currentLocationKey:target.key};
  setPartyState(db,player.partyId,"dm",nextState);
  rememberKnownLocation(db,player.partyId,{name:target.label,summary:target.summary || `A discovered part of ${adventure.title}.`});
  const nextExits=connected(target).filter((room)=>revealed.has(room.key)||room.key===current.key);
  addEvent(db,{partyId:player.partyId,visibility:"public",kind:"narration",speaker:"Dungeon Master",text:`${player.name} moves from ${current.label} into ${target.label}. Visible here: ${(target.features||[]).join(", ") || "the established surroundings"}. Revealed exits lead to ${nextExits.map((room)=>room.label).join(", ") || current.label}.`});
  return true;
}

function resolveOutOfRoomFeatureAction(db,player,adventure,dmState,mode,action){
  if(mode!=="act")return false;
  const current=currentAuthoredLocation(adventure,dmState);
  if(!current)return false;
  const featureRoom=featureLocationRule(adventure.id,action);
  if(!featureRoom || featureRoom.key===current.key)return false;
  addEvent(db,{partyId:player.partyId,visibility:"public",kind:"narration",speaker:"Dungeon Master",text:`That feature is not in ${current.label}. ${(current.features||[]).length?`Visible here: ${(current.features||[]).join(", ")}.`:""} Move through a revealed connecting room before interacting with anything elsewhere.`});
  return true;
}

function resolveLocationQuestion(db,player,adventure,dmState,mode,action){
  if(!["act","ask"].includes(mode)) return false;
  const words=String(action||"").trim().toLowerCase();
  const asksLocation=/\bwhere (?:am i|are we|are you|is the party)\b/.test(words)
    || /\b(?:what|which) (?:place|room|area|location) (?:am i|are we|is this)\b/.test(words);
  if(!asksLocation)return false;
  const locations=getKnownLocations(db,player.partyId);
  const authored=currentAuthoredLocation(adventure,dmState);
  const current=authored ? {name:authored.label,summary:`Visible features: ${(authored.features||[]).join(", ") || "the established surroundings"}.`} : locations.at(-1);
  const text=current
    ? `You are in ${current.name}. ${current.summary} This is the party's latest recorded location; the Known map shows the explored route to it.`
    : `The party has not recorded a named location yet. The Known map will identify places once the party reaches or clearly discovers them.`;
  addEvent(db,{partyId:player.partyId,visibility:"public",playerId:player.id,kind:"narration",speaker:"Dungeon Master",text});
  return true;
}

function resolveRepeatedPickup(db,player,mode,action,recentHistory){
  if(mode!=="act")return false;
  const words=String(action||"").trim().toLowerCase().replace(/\blamp\b/g,"lantern");
  if (/\b(cotton|woltanade|floof|ragdoll cat|god in cat form)\b/.test(words)) return false;
  const pickup=words.match(/\b(?:pick\s*up|pickup|take|grab|collect|retrieve)\b\s+(?:the |a |an )?([^,.;]+)/);
  if(!pickup)return false;
  const requested=pickup[1].split(/\b(?:and then|then|and|use|open|inspect|examine|carry|store|put)\b/)[0].trim();
  const requestedTerms=requested.split(/[^a-z0-9]+/).filter((term)=>term.length>2 && !["this","that","item"].includes(term));
  if(!requestedTerms.length)return false;
  const existing=(player.inventory||[]).find((item)=>{
    const name=String(item.name||"").toLowerCase().replace(/\blamp\b/g,"lantern");
    return requestedTerms.some((term)=>name.includes(term));
  });
  if(!existing)return false;
  const history=(recentHistory||[]).filter((event)=>event.visibility!=="dm");
  const itemTerms=String(existing.name||"").toLowerCase().replace(/\blamp\b/g,"lantern").split(/[^a-z0-9]+/).filter((term)=>term.length>2);
  const mentionsItem=(event)=>{
    const text=String(event.text||"").toLowerCase().replace(/\blamp\b/g,"lantern");
    return itemTerms.some((term)=>text.includes(term))||requestedTerms.some((term)=>text.includes(term));
  };
  let lastRecorded=-1;
  let lastNewObject=-1;
  history.forEach((event,index)=>{
    const text=String(event.text||"").toLowerCase();
    if(event.kind==="system"&&String(event.speaker||"").toLowerCase()==="inventory"&&mentionsItem(event))lastRecorded=index;
    if(event.kind==="narration"&&mentionsItem(event)&&/\b(?:another|second|additional|different|new|finds?|found|reveals?|inside|rests?|lies?|contains?)\b/.test(text))lastNewObject=index;
  });
  if(lastRecorded<0||lastNewObject>lastRecorded)return false;
  addEvent(db,{partyId:player.partyId,visibility:"public",playerId:player.id,kind:"narration",speaker:"Dungeon Master",text:`${player.name} already picked up that ${existing.name}; it is recorded in the inventory. Nothing is added a second time. If a different object of the same kind has appeared, identify it by its visible description.`});
  return true;
}

function resolveLanternBoundaryAction(db, player, adventure, dmState, mode, action, recentHistory=[]) {
  if (mode !== "act" || !String(adventure?.id || "").endsWith("lantern-below")) return false;
  const stage = Number(dmState.clueStage || 0);
  const words = String(action || "").trim().toLowerCase();
  const referencesUndiscoveredRoute = /\b(passage|tunnel|cellar|stair|stairs|chamber|pulsing darkness|hidden route|secret route)\b/.test(words);
  const vagueForwardMovement = /\b(?:advance|continue|go|move|walk|head|proceed)\w*\b/.test(words) && /\b(?:forward|deeper|ahead|onward|pulsing)\b/.test(words);
  const interactionKey = `interactions:${adventure?.id || "adventure"}`;
  const keyedDoor = (getPartyState(db, player.partyId, interactionKey) || {}).keyedDoor || {};
  const acceptedDoorEntry = (recentHistory || []).filter((event)=>event.visibility!=="dm").slice(-10).some((event)=>/\b(?:steps?|walks?|goes?|passes?|enters?|crosses?)\b[^.]{0,80}\b(?:through|into|past)\b[^.]{0,50}\b(?:door|doorway|passage)\b/i.test(String(event.text || "")));
  if (stage <= 2 && keyedDoor.unlocked && acceptedDoorEntry && (referencesUndiscoveredRoute || vagueForwardMovement)) {
    setPartyState(db, player.partyId, "dm", { ...dmState, clueStage:4 });
    rememberKnownLocation(db, player.partyId, { name:"The Cellar Passage", summary:"The party crossed the unlocked door into an old passage beneath the inn." });
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`The opened doorway remains behind ${player.name}; the party has not returned to the pantry. ${player.name} follows the passage to Mara Vey's abandoned survey mark, which confirms that she continued onward from here.` });
    addEvent(db, { partyId:player.partyId, visibility:"dm", kind:"system", speaker:"DM Ledger", text:"Continuity repair: an accepted door crossing advanced The Lantern Below to clue stage 4 instead of regressing to the ink-mite route." });
    updateGuidance(db, player, 4);
    return true;
  }
  if (stage > 2 || (!referencesUndiscoveredRoute && !vagueForwardMovement)) return false;

  const text = stage === 0
    ? `No underground route has been discovered. ${player.name} is still at the Crooked Lantern with the sealed silver-moth letter; opening or examining what is actually present must come before travelling into an unknown passage.`
    : stage === 1
      ? `No passage has been revealed. ${player.name} has the opened letter, its dormant ink-mite, and Mara Vey's instructions; the silver moth must be warmed and the ink-mite offered fresh ink before it can draw a route.`
      : `The ink-mite's drawn route ends at the pantry shelves. No stair or passage is visible yet; ${player.name} must search the shelves where the route ends before travelling below the inn.`;
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text });
  addEvent(db, { partyId:player.partyId, visibility:"dm", kind:"system", speaker:"DM Ledger", text:`Authoritative clue stage ${stage} rejected movement into a route that has not been discovered.` });
  setPlayerGuidance(db, player.id, player.partyId, []);
  return true;
}

export function ensureConcreteMovementResult(playerName, action, director, narration) {
  const words = String(action || "").toLowerCase();
  const isMovement = /\b(?:advance|continue|enter|follow|go|walk|run|sprint|head|proceed|descend|ascend|travel|approach|venture)\w*\b/.test(words)
    || /\bmove\w*\b[^.]{0,35}\b(?:forward|back|ahead|onward|toward|towards|into|through|past|along|deeper|farther|further)\b/.test(words);
  if (!isMovement) return narration;
  const facts = Array.isArray(director?.publicFacts) ? director.publicFacts.join(" ") : "";
  const resultText = `${facts} ${narration}`.toLowerCase();
  const actor=String(playerName||"").toLowerCase().replace(/[^a-z0-9 ]/g,"").trim();
  const escaped=actor.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const actorArrival=new RegExp(`\\b(?:${escaped || "the character"}|you)\\s+(?:arrive\\w*|reach\\w*|enter\\w*|cross\\w*|step\\w*\\s+(?:into|through)|come\\w*\\s+to)\\b`);
  const hasDefiniteArrival = actorArrival.test(resultText) && /\b(?:room|chamber|hall|alcove|junction|landing|doorway|threshold|courtyard|road|camp|village|tower|passage end|end of (?:the )?passage|stairs?|cellar|location)\b/.test(resultText);
  const hasDefiniteStop = /\b(?:blocked|dead end|ends here|ends at|cannot continue|cannot pass|no farther|no further|impassable|locked|sealed|collapsed|obstruction)\b/.test(resultText);
  if (hasDefiniteArrival || hasDefiniteStop) return narration;
  return `${playerName} follows the accessible route until it reaches a definite stopping point. No doorway, junction, new chamber, or farther accessible section is currently established here; ${playerName} must examine a visible feature, choose another route, or turn back rather than continue through undefined darkness.`;
}

function offerLanternChamberCheck(db, player, adventure, dmState, mode, action, preparedContext) {
  if (!String(adventure?.id || "").endsWith("lantern-below") || Number(dmState.clueStage || 0) !== 5 || preparedContext.nextClueStage !== 5) return false;
  const words = String(action || "").toLowerCase();
  const asksForCheck = mode === "ask" && /\b(perception|investigation|check|search)\b/.test(words);
  const searchesRoom = mode === "act" && /\b(search|look|inspect|investigate|examine)\w*\b/.test(words) && /\b(room|chamber|door|hidden|feature|lantern|exit|item)\b/.test(words);
  if (!asksForCheck && !searchesRoom) return false;
  const useInvestigation = /\binvestigat/.test(words);
  const ability = useInvestigation ? "Intelligence" : "Wisdom";
  const skill = useInvestigation ? "Investigation" : "Perception";
  const modifier = skillModifier(player, ability, skill);
  const pending = {
    ability, skill, modifier, dc:12, successStage:6,
    reason:"Notice how the apparently empty mothglass chamber opens without revealing anything beyond it.",
    successText:`${player.name} studies the chamber carefully and notices that the hanging lantern is attached to a counterweighted spindle, not an ordinary hook. A narrow vertical seam runs down the wall behind it; turning or pulling the lantern should operate the mechanism.`,
    failureText:`${player.name} cannot make out a hidden opening through the shifting lantern light. Mara's final survey arrow still points upward toward the hanging lantern, so examining the fixture directly or trying a different approach remains possible.`,
  };
  setPartyState(db, player.partyId, `pendingCheck:${player.id}`, pending);
  setPlayerGuidance(db, player.id, player.partyId, []);
  const sign = modifier >= 0 ? "+" : "";
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`Make a ${ability} (${skill}) check: roll d20 ${sign}${modifier} against DC ${pending.dc}. ${pending.reason}` });
  return true;
}

function offerLanternSafetyCheck(db, player, adventure, dmState, mode, action) {
  const currentStage = Number(dmState.clueStage || 0);
  if (!String(adventure?.id || "").endsWith("lantern-below") || ![6, 7].includes(currentStage) || mode !== "act") return false;
  const words = String(action || "").toLowerCase();
  const isCarefulSearch = /\b(check|search|look|inspect|investigate|examine)\w*\b/.test(words);
  const isSafetyQuestion = /\b(trap|hazard|trigger|hidden mechanism|concealed mechanism|danger)\w*\b/.test(words);
  if (!isCarefulSearch || !isSafetyQuestion) return false;

  const studiesMechanism = /\b(mechanism|trigger)\w*\b/.test(words) && !/\btrap|hazard|danger\b/.test(words);
  const ability = studiesMechanism ? "Intelligence" : "Wisdom";
  const skill = studiesMechanism ? "Investigation" : "Perception";
  const modifier = skillModifier(player, ability, skill);
  const pending = {
    ability, skill, modifier, dc:12, successStage:currentStage,
    reason:"Determine whether the visible seam and lantern fixture show signs of a trap without assuming the area is safe.",
    successText:`${player.name} methodically checks the wall seam, the surrounding stone, and the lantern's spindle. No tripwire, pressure catch, concealed trigger, or other physical sign of a trap is visible; the only mechanism ${player.name} can confirm is the counterweighted lantern fixture already discovered.`,
    failureText:`${player.name} checks the seam and lantern fixture, but the cramped angles and shifting light make the details difficult to judge. No trap is immediately obvious, but ${player.name} cannot confidently rule out a concealed trigger.`,
  };
  setPartyState(db, player.partyId, `pendingCheck:${player.id}`, pending);
  setPlayerGuidance(db, player.id, player.partyId, []);
  const sign = modifier >= 0 ? "+" : "";
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`Make a ${ability} (${skill}) check: roll d20 ${sign}${modifier} against DC ${pending.dc}. ${pending.reason}` });
  return true;
}

function offerLanternRescueCheck(db, player, adventure, dmState, mode, action) {
  if (!String(adventure?.id || "").endsWith("lantern-below") || Number(dmState.clueStage || 0) !== 9 || mode !== "act") return false;
  const words = String(action || "").toLowerCase();
  if (!/\b(clear|move|lift|shift|remove|free|rescue)\w*\b/.test(words) || !/\b(stone|rock|rubble|collapse|mara)\w*\b/.test(words)) return false;
  const ability = "Strength";
  const skill = "Athletics";
  const modifier = skillModifier(player, ability, skill);
  const pending = {
    ability, skill, modifier, dc:12, successStage:9, completeAdventureOnSuccess:true,
    reason:"Move the unstable stones without bringing the damaged passage down on Mara.",
    successText:`${player.name} braces against the soundest stones and shifts the loose rubble in a controlled sequence. Mara crawls free as the remaining weight settles safely behind her; she is shaken but alive, and the immediate danger beneath the Crooked Lantern is over.`,
    failureText:`${player.name} begins shifting the rubble, but the weight above grinds and settles toward the opening. ${player.name} stops before the collapse worsens; Mara remains reachable, but freeing her safely will require another approach or assistance.`,
  };
  setPartyState(db, player.partyId, `pendingCheck:${player.id}`, pending);
  setPlayerGuidance(db, player.id, player.partyId, []);
  const sign = modifier >= 0 ? "+" : "";
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`Make a ${ability} (${skill}) check: roll d20 ${sign}${modifier} against DC ${pending.dc}. ${pending.reason}` });
  return true;
}

function resolveUnsupportedConjuration(db, player, mode, action) {
  if (mode !== "act") return false;
  const words = String(action || "").toLowerCase();
  if (!/\b(magically|magic|spell|conjure|summon|create)\w*\b/.test(words) || !/\b(appear|make|create|conjure|summon)\w*\b/.test(words)) return false;
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`${player.name} attempts to produce the requested effect, but no recorded spell, item, or class feature on the character sheet can create it. Nothing appears and the scene does not change; choose a feature the character possesses or ask the DM which options apply.` });
  return true;
}

function resolveLanternSpeech(db, player, adventure, dmState, mode) {
  if (mode !== "speak" || !String(adventure?.id || "").endsWith("lantern-below") || Number(dmState.clueStage || 0) < 8) return false;
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`${player.name}'s words carry through the stone chamber. Mara can hear the voice beyond the loose stones, but the words reveal no new feature or change in the chamber.` });
  return true;
}

function looksLikeWorldAction(question) {
  const words = String(question || "").trim().toLowerCase();
  return /^(?:i |we |can i |could i |would i |please )?(?:attempt to |try to |try and )?(?:open|close|enter|leave|go|move|walk|run|climb|descend|follow|turn|rotate|pull|push|twist|lift|take|pick|grab|drop|give|use|light|burn|break|attack|cast|search|inspect|examine|touch|operate|help|free|rescue)\b/.test(words);
}

async function resolveDmQuestion(db, player, action, preparedContext, playerSafeHistory) {
  const question = String(action || "").trim();
  const lower = question.toLowerCase();
  let answer = "";

  if (looksLikeWorldAction(question)) {
    const requestedAction = question.replace(/^(?:i |we |can i |could i |would i |please )?(?:attempt to |try to |try and )?/i, "").replace(/[?.!]+$/, "");
    answer = `That would be an action rather than a rules question. Switch to Act to have ${player.name} ${requestedAction}.`;
  } else if (/\b(not (?:very )?nice|that was rude|you(?:'re| are) rude|mean)\b/.test(lower)) {
    answer = "You're right—that response was too abrupt. You can ask questions or try unusual ideas without being spoken down to; I’ll answer plainly and keep the game world separate from out-of-character help.";
  } else if (/\b(?:what|which|show|list|have|remaining)\b.*\b(?:spell|spells|cantrip|slots?)\b|\bspell (?:list|slots?)\b/.test(lower)) {
    const magic = player.spellcasting;
    if (!magic) answer = `${player.name}'s ${player.className} character sheet has no Spellcasting or Pact Magic feature at level ${player.level}.`;
    else {
      const slots = Object.entries(magic.slots || {}).map(([level, slot]) => `level ${level}: ${slot.current}/${slot.max}`).join(", ") || "none";
      const prepared = (magic.prepared || []).join(", ") || "none";
      const cantrips = (magic.cantrips || []).join(", ") || "none";
      const book = (magic.spellbook || []).length ? ` The spellbook contains: ${magic.spellbook.join(", ")}.` : "";
      answer = `${player.name}'s cantrips are ${cantrips}. Prepared levelled spells: ${prepared}. Remaining spell slotsâ€”${slots}.${book} Cantrips do not spend spell slots.`;
    }
  } else if (/\b(dexterity|dex|sleight|thieves|thief)\b/.test(lower)) {
    answer = "Dexterity applies when the approach depends on speed, balance, stealth, or delicate physical manipulation—for example, a Dexterity check using thieves’ tools. Working out how a mechanism functions is normally Intelligence (Investigation), while noticing its visible details is Wisdom (Perception). Describe the approach under Act, and the DM will call for a roll if failure is meaningful.";
  } else if (!(await isOllamaReady())) {
    answer = "Ask about a rule, a visible detail, or which ability might fit an approach. To make your character do something in the scene, switch to Act; the DM will call for a roll when the outcome is uncertain and failure matters.";
  } else {
    try {
      const result = await ollamaChat([
        { role:"system", content:"You are an out-of-character rules adviser for a revised 2024 D&D game. Answer the player's direct question clearly and briefly using only the supplied character sheet, visible history, and player-facing scene facts. Never narrate or execute an action, change the scene, decide an outcome, move an object or character, advance a clue, or reveal anything marked unknown by the scene boundary. If the request is actually an attempted action, tell the player to use Act. Explain which ability, skill, or rule could apply, but do not invent a DC or require a roll unless the visible facts already specify one. Suggestions must use only visible facts and must not imply that a hidden object, route, creature, or answer exists. Return 0–2 optional suggestions." },
        { role:"user", content:JSON.stringify({ question, character:{ name:player.name, className:player.className, level:player.level, abilities:player.abilities, skills:player.skills, spellcasting:player.spellcasting, inventory:(player.inventory || []).map((item)=>({name:item.name,quantity:item.quantity,status:item.status})) }, recentVisibleHistory:playerSafeHistory, currentPlayerFacingScene:preparedContext.state.unlockedPlayerFacingContext }) },
      ], questionSchema, { temperature:0.28, numPredict:280 });
      answer = String(result.answer || "").trim();
      const guidanceMode = getGuidanceMode(db, player.partyId);
      if (guidanceMode !== "classic") setPlayerGuidance(db, player.id, player.partyId, safeNarratorSuggestions(result.suggestions).slice(0, 2));
    } catch (error) {
      console.warn("DM question failed; using a rules-only fallback:", error.message);
      answer = "I can clarify a rule or something already visible, but I cannot perform an action from Help / Ask DM. Switch to Act and describe what your character tries; the DM will request a roll if one is needed.";
    }
  }

  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:answer });
  return { source:"rules" };
}

async function resolveGeneralCheckNarration(db, player, pending, rollResult) {
  const recentHistory = listRecentEventsForDm(db, player.partyId, 30);
  const lastAction = [...recentHistory].reverse().find((event) => event.kind === "action" && event.playerId === player.id);
  const action = String(pending.action || lastAction?.text || "").replace(/^\s*(?:attempts|says|asks the dm)\s*:\s*/i, "");
  const adventure = getActiveAdventure(db, player.partyId);
  const dmState = getPartyState(db, player.partyId, "dm") || { dangerClock:0 };
  const preparedContext = prepareCampaignContext(adventure, dmState, action);
  if (!(await isOllamaReady())) return { text:rollResult.success ? pending.successText : pending.failureText, preparedContext, director:null };

  try {
    const visibleHistory = recentHistory.filter((event) => event.visibility !== "dm").slice(-20);
    const director = await ollamaChat([
      { role:"system", content:"You resolve a D&D ability check that has already been rolled. Give a concrete outcome, not a description of the checking procedure. Use only established visible history and the supplied campaign context. On success, explicitly state what the character actually discovers or accomplishes; if there is nothing discoverable in the searched area, explicitly state that no relevant sign or mechanism is found there. On failure, state what remains unresolved without inventing a new hazard. Never request another roll, repeat the check instructions, reveal a later gated secret, invent a new object or route, or move the character beyond the declared action. Respect the precise action: Investigation examines evidence but does not operate a mechanism; Perception notices but does not disarm; Athletics moves only the declared obstacle. publicFacts must contain 1-3 concrete outcome facts. requiredCheck and checkReason must be empty because the roll is complete. inventoryChanges must be empty unless the check itself explicitly completed a transfer. Set adventureComplete only if the supplied campaign context expressly makes this exact successful check the final condition." },
      { role:"user", content:JSON.stringify({ adventure, campaignContext:preparedContext.state, character:{name:player.name,className:player.className,level:player.level,abilities:player.abilities,skills:player.skills,inventory:player.inventory}, declaredAction:action, check:{ability:pending.ability,skill:pending.skill,dc:pending.dc,rawRoll:rollResult.raw,total:rollResult.total,success:rollResult.success}, recentVisibleHistory:visibleHistory }) },
    ], directorSchema, { temperature:0.28, numPredict:420 });
    const narrator = await ollamaChat([
      { role:"system", content:"Narrate the concrete result of an already-resolved D&D check in 1-3 clear sentences. The first sentence must say what was actually found, learned, moved, or failed—not how carefully the character searched. Use only the supplied public facts. Do not ask for another roll, add atmosphere that implies an unlisted secret, repeat earlier narration, or advance beyond the declared action. If the facts establish that nothing relevant was found, say so plainly. Return no suggestions." },
      { role:"user", content:JSON.stringify({ characterName:player.name, declaredAction:action, checkResult:rollResult.success ? "success" : "failure", publicFacts:director.publicFacts, recentVisibleHistory:visibleHistory.slice(-10) }) },
    ], narrationSchema, { temperature:0.32, numPredict:240 });
    return { text:String(narrator.narration || "").trim() || (rollResult.success ? pending.successText : pending.failureText), preparedContext, director };
  } catch (error) {
    console.warn("General check resolution failed; using the rules fallback:", error.message);
    return { text:rollResult.success ? pending.successText : pending.failureText, preparedContext, director:null };
  }
}

export async function resolvePendingCheck(db, player, roll) {
  const key = `pendingCheck:${player.id}`;
  const pending = getPartyState(db, player.partyId, key);
  if (!pending || !Number.isFinite(Number(pending.dc))) return null;
  const raw = Number(roll);
  const modifier = Number(pending.modifier || 0);
  const total = raw + modifier;
  const success = total >= Number(pending.dc);
  const sign = modifier >= 0 ? "+" : "";
  addEvent(db, { partyId:player.partyId, visibility:"public", playerId:player.id, kind:"roll", speaker:"Dice", text:`${player.name} rolled ${raw} ${sign}${modifier} = ${total} for ${pending.skill} against DC ${pending.dc}: ${success ? "success" : "failure"}.`, payload:{ sides:20, result:raw, modifier, total, dc:pending.dc, skill:pending.skill, success } });
  setPartyState(db, player.partyId, key, null);
  const generalResult = pending.generalRule ? await resolveGeneralCheckNarration(db, player, pending, { raw, modifier, total, success }) : null;
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:generalResult?.text || (success ? pending.successText : pending.failureText) });
  if (pending.generalRule && success && Number.isFinite(Number(generalResult?.preparedContext?.nextClueStage))) {
    const currentState = getPartyState(db, player.partyId, "dm") || {};
    const director = generalResult?.director;
    setPartyState(db, player.partyId, "dm", { ...currentState, clueStage:Math.max(Number(currentState.clueStage || 0), Number(generalResult.preparedContext.nextClueStage)), dangerClock:Math.max(0, Number(currentState.dangerClock || 0) + Number(director?.dangerChange || 0)) });
    if (director?.hiddenNote) addEvent(db, { partyId:player.partyId, visibility:"dm", kind:"system", speaker:"DM Ledger", text:director.hiddenNote });
    if (director?.locationName) rememberKnownLocation(db, player.partyId, { name:director.locationName, summary:director.locationNote });
    if (director?.adventureComplete) completeActiveAdventure(db, player.partyId);
  }
  if (success && Number.isFinite(Number(pending.successStage))) {
    const dmState = getPartyState(db, player.partyId, "dm") || {};
    setPartyState(db, player.partyId, "dm", { ...dmState, clueStage:Math.max(Number(dmState.clueStage || 0), Number(pending.successStage)) });
  }
  if (success && pending.completeAdventureOnSuccess) {
    completeActiveAdventure(db, player.partyId);
    setPlayerGuidance(db, player.id, player.partyId, []);
  } else updateGuidance(db, player, success ? pending.successStage : Number(getPartyState(db, player.partyId, "dm")?.clueStage || 0), null, !success);
  return { ability:pending.ability, skill:pending.skill, modifier, total, dc:Number(pending.dc), success };
}

function applyResolvedInventoryChanges(db, player, adventure, action, publicFacts, changes) {
  if (!Array.isArray(changes) || !changes.length) return;
  const normalizedAction = String(action || "").toLowerCase().replace(/\blamp\b/g, "lantern");
  if (/\b(cotton|woltanade|floof|ragdoll cat|god in cat form)\b/.test(normalizedAction)) return;
  const facts = Array.isArray(publicFacts) ? publicFacts.join(" ").toLowerCase().replace(/\blamp\b/g, "lantern") : "";
  const adding = /\b(pick|pickup|take|grab|collect|retrieve|accept|receive)\w*\b/.test(normalizedAction);
  const removing = /\b(drop|discard|give|hand|leave|lose|destroy|throw away)\w*\b/.test(normalizedAction);
  const summaries = [];
  for (const change of changes.slice(0, 6)) {
    const itemName = String(change.itemName || "").trim().replace(/\s+/g, " ").slice(0,80);
    if (/\b(cotton|woltanade|floof|ragdoll cat|god in cat form)\b/i.test(itemName)) continue;
    const searchableName = itemName.toLowerCase().replace(/\blamp\b/g, "lantern");
    const keywords = searchableName.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !["the","and","with","from"].includes(word));
    const namedInAction = keywords.some((word) => normalizedAction.includes(word));
    const confirmedInResult = keywords.some((word) => facts.includes(word));
    if (!itemName || !namedInAction || !confirmedInResult) continue;
    const quantity = Math.max(1, Math.min(999, Number(change.quantity || 1)));
    if (change.operation === "add" && adding) {
      const status = /\b(equip|wear|wield)\w*\b/.test(normalizedAction) ? "equipped" : "carried";
      addInventoryItem(db, player.id, { name:itemName, quantity, status, notes:String(change.note || "").slice(0,180), sourceAdventureId:adventure?.id || null });
      summaries.push(`added ${quantity > 1 ? `${quantity} × ` : ""}${itemName}`);
    } else if (change.operation === "remove" && removing && removeInventoryItem(db, player.id, itemName, quantity)) summaries.push(`removed ${quantity > 1 ? `${quantity} × ` : ""}${itemName}`);
  }
  if (summaries.length) addEvent(db, { partyId:player.partyId, visibility:"public", playerId:player.id, kind:"system", speaker:"Inventory", text:`${player.name} ${summaries.join(" and ")}.` });
}

function applyExplicitInventoryLanguage(db, player, adventure, action, recentHistory, publicFacts) {
  const normalized = String(action || "").toLowerCase().replace(/\blamp\b/g, "lantern");
  if (/\b(cotton|woltanade|floof|ragdoll cat|god in cat form)\b/.test(normalized)) return false;
  const knownText = [...recentHistory.filter((event) => event.visibility !== "dm" && event.kind !== "action").map((event) => event.text), ...(Array.isArray(publicFacts) ? publicFacts : [])].join(" ").toLowerCase().replace(/\blamp\b/g, "lantern");
  const pickup = normalized.match(/\b(?:pick\s*up|pickup|take|grab|collect|retrieve)\b\s+(.+)/);
  if (pickup) {
    const nounPhrase = pickup[1].split(/\b(?:and\s+)?(?:light|ignite|open|use|wear|equip|inspect|examine|look|carry|go|walk|enter)\w*\b/)[0];
    const candidates = nounPhrase.split(/\s*(?:,|\band\b)\s*/).map((value) => value.replace(/^(?:the|a|an|some)\s+/, "").replace(/\b(?:them|both|it)\b.*$/, "").trim()).filter(Boolean).slice(0,6);
    const added = [];
    for (const candidate of candidates) {
      const words = candidate.split(/[^a-z0-9]+/).filter((word) => word.length > 2);
      if (!words.length || !words.some((word) => knownText.includes(word))) continue;
      const name = candidate.replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0,80);
      const isMap = /\b(map|chart|floor ?plan|plans)\b/i.test(name);
      const mapSource = isMap ? [...recentHistory].reverse().find((event) => event.visibility !== "dm" && event.kind === "narration" && /\b(map|chart|floor ?plan|plans)\b/i.test(String(event.text || ""))) : null;
      const notes = mapSource ? String(mapSource.text || "").replace(/\s+/g," ").trim().slice(0,420) : `Acquired during ${adventure?.title || "the adventure"}.`;
      addInventoryItem(db, player.id, { name, quantity:1, status:"carried", notes, sourceAdventureId:adventure?.id || null });
      added.push(name);
    }
    if (added.length) {
      addEvent(db, { partyId:player.partyId, visibility:"public", playerId:player.id, kind:"system", speaker:"Inventory", text:`${player.name} added ${added.join(" and ")}.` });
      return true;
    }
  }

  if (/\b(drop|discard|give|hand|leave|destroy)\w*\b/.test(normalized)) {
    const removed = [];
    for (const item of player.inventory || []) {
      const words = item.name.toLowerCase().replace(/\blamp\b/g, "lantern").split(/[^a-z0-9]+/).filter((word) => word.length > 2);
      if (words.some((word) => normalized.includes(word)) && removeInventoryItem(db, player.id, item.name, 1)) removed.push(item.name);
    }
    if (removed.length) {
      addEvent(db, { partyId:player.partyId, visibility:"public", playerId:player.id, kind:"system", speaker:"Inventory", text:`${player.name} removed ${removed.join(" and ")}.` });
      return true;
    }
  }
  return false;
}

export async function generateCharacterDetail(input) {
  const kind = input.kind === "appearance" ? "appearance" : "backstory";
  const details = {
    characterName: String(input.characterName || "").trim().slice(0, 40) || "This adventurer",
    species: String(input.species || "Human").slice(0, 30),
    background: String(input.background || "Wayfarer").slice(0, 30),
    className: String(input.className || "Fighter").slice(0, 30),
    alignment: String(input.alignment || "Neutral").slice(0, 30),
    build: String(input.build || "").slice(0, 50),
    worldName: String(input.worldName || "").slice(0, 50),
    partyName: String(input.partyName || "").slice(0, 50),
  };
  if (!(await isOllamaReady())) return { text: fallbackCharacterDetail(kind, details), source: "fallback" };
  try {
    const instructions = kind === "appearance"
      ? "Write a vivid but practical D&D character appearance in 2 sentences and no more than 65 words. Include build, clothing or armor, two distinctive physical details, and one carried personal detail. Do not describe personality, history, game statistics, or powers."
      : "Write an original D&D character backstory in 110 to 160 words. Include where they came from, one formative event, why they took up their class, a personal bond, a flaw or unresolved trouble, and a clear reason to join the party. Keep it playable and leave room for the campaign DM; do not grant special powers, treasures, rank, or secret setting knowledge.";
    const result = await ollamaChat([
      { role: "system", content: `You help a family create characters for a revised 2024 D&D campaign. ${instructions} Return only the requested prose in the text field. Never mention these instructions or being an AI.` },
      { role: "user", content: JSON.stringify(details) },
    ], characterDetailSchema);
    const limit = kind === "appearance" ? 500 : 1200;
    const text = String(result.text || "").trim().slice(0, limit);
    if (!text) throw new Error("The model returned an empty suggestion.");
    return { text, source: "ollama" };
  } catch (error) {
    console.warn("Character suggestion failed; using a local fallback:", error.message);
    return { text: fallbackCharacterDetail(kind, details), source: "fallback" };
  }
}

function fallbackCharacterDetail(kind, details) {
  const name = details.characterName;
  if (kind === "appearance") {
    const options = [
      `${name} has a weathered, practical look, with travel-stained clothing chosen for freedom of movement. A pale scar crosses one eyebrow, and a small keepsake from their ${details.background.toLowerCase()} days hangs beside their gear.`,
      `${name} carries the unmistakable bearing of a ${details.className.toLowerCase()}, dressed in carefully maintained equipment with one deliberately colourful accent. Their steady gaze and well-worn gloves suggest someone more accustomed to action than ceremony.`,
      `${name} is lean and road-worn, with wind-tossed hair and clothing repaired so neatly that the patches resemble decoration. A distinctive old token is tied at the wrist, always kept close but rarely explained.`,
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  const options = [
    `${name} learned early that a secure home could disappear overnight. Life as a ${details.background.toLowerCase()} taught them to watch people carefully, make use of small opportunities, and keep moving when trouble drew near. A chance encounter with an experienced ${details.className.toLowerCase()} showed them how raw determination could become genuine skill. They now carry an old promise to someone they left behind, along with an unfortunate habit of taking responsibility for problems that are not theirs. Joining ${details.partyName || "the company"} offers honest companionship, a chance to prove what they have become, and perhaps a path back to the unfinished business waiting in their past.`,
    `${name} once expected an ordinary life shaped by their ${details.background.toLowerCase()} upbringing. That changed when a local crisis forced them to act while more experienced people hesitated. The outcome was imperfect, but it revealed the instincts of a ${details.className.toLowerCase()} and left them determined to train properly. They remain fiercely loyal to the people who believed in them, yet privately fear repeating the mistake that first sent them onto the road. They joined ${details.partyName || "the adventuring company"} because its cause matters, its members need someone with their talents, and travelling together is safer than facing the consequences of their past alone.`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function resolveStructuredWorldAction(db, player, adventure, dmState, mode, action) {
  const definition = adventureDefinition(adventure);
  if (!definition) return false;

  const worldKey = `world:${definition.id}`;
  const savedWorld = getPartyState(db, player.partyId, worldKey);
  // Saves created before the structured world-state engine already carry their
  // progress in the legacy clue/interactions state. Let the compatibility
  // rules finish those sessions instead of treating them as a fresh arrival.
  const hasLegacyLanternProgress = definition.id === "lantern-below"
    && !savedWorld
    && Number(dmState?.clueStage || 0) > 0
    && !dmState?.currentLocationKey;
  if (hasLegacyLanternProgress) return false;
  const legacyLocation = definition.locations?.[dmState.currentLocationKey]
    ? dmState.currentLocationKey
    : definition.startLocation;
  const world = createInitialWorldState(definition, savedWorld || { currentLocation: legacyLocation });
  const outcome = resolveWorldAction({
    definition,
    state: world,
    action,
    actorId: player.id,
    inventory: listInventory(db, player.id),
    mode,
  });

  if (!outcome.handled || outcome.intent === "observe") return false;

  if (outcome.accepted) {
    setPartyState(db, player.partyId, worldKey, outcome.state);
    let nextDmState = { ...dmState };
    for (const event of outcome.events || []) {
      if (event.type === "location-entered") {
        const location = definition.locations[event.locationId];
        nextDmState = {
          ...nextDmState,
          currentLocationKey: event.locationId,
          locationName: location.name,
          locationNote: location.summary,
        };
        if (Number.isFinite(Number(location.stage))) {
          const stateKey = definition.stateKey || "clueStage";
          nextDmState[stateKey] = Math.max(Number(nextDmState[stateKey] || 0), Number(location.stage));
        }
        setPartyState(db, player.partyId, "dm", nextDmState);
        rememberKnownLocation(db, player.partyId, { name: location.name, summary: location.summary });
      }
      if (event.type === "item-acquired") {
        const item = definition.items[event.itemId];
        addInventoryItem(db, player.id, {
          name: item.name,
          quantity: 1,
          status: "carried",
          notes: item.notes || `Acquired during ${adventure.title}.`,
          origin: "adventure",
          sourceAdventureId: adventure.id,
        });
      }
    }
  }

  addEvent(db, {
    partyId: player.partyId,
    adventureId: adventure.id,
    visibility: "public",
    playerId: player.id,
    kind: "narration",
    speaker: "Dungeon Master",
    text: outcome.message,
  });
  return true;
}

export async function resolveAction(db, player, mode, action) {
  const dmState = getPartyState(db, player.partyId, "dm") || { dangerClock: 0 };
  const adventure = getActiveAdventure(db, player.partyId);
  if(adventure?.status==="complete"){
    const lantern=String(adventure.id||"").endsWith("lantern-below");
    const text=lantern&&mode==="speak"
      ? `Mara draws a steadying breath and answers ${player.name}, "I'm shaken, but I'm all right. You got me out in time." The danger beneath the Crooked Lantern is over.`
      : mode==="ask"
        ? `${adventure.title} is complete. Finish any earned level-ups on the Character sheet, or return to the Campaign Library when the company is ready for its next adventure.`
        : `The immediate danger is over and ${adventure.title} is complete. Nothing more needs to be cleared or rescued here; finish any earned level-ups on the Character sheet or choose the company's next adventure.`;
    addEvent(db,{partyId:player.partyId,visibility:"public",playerId:player.id,kind:"narration",speaker:lantern&&mode==="speak"?"Mara Vey":"Dungeon Master",text});
    setPlayerGuidance(db,player.id,player.partyId,[]);
    return {source:"rules"};
  }
  const humanParty = listPlayers(db, player.partyId);
  const cotton = cottonForParty(db, player.partyId);
  const party = [
    ...humanParty.map((item) => ({ name: item.name, class: item.className, species: item.species, level: item.level, hp: item.hp })),
    { name: cotton.name, fullName: cotton.fullName, class: cotton.className, species: cotton.species, level: cotton.level, hp: "immortal" },
  ];
  const recentHistory = listRecentEventsForDm(db, player.partyId, 36);
  const directorHistory = recentHistory.filter((event) => event.visibility !== "dm");
  const playerSafeHistory = recentHistory.filter((event) => event.visibility === "public" || (event.visibility === "player" && event.playerId === player.id)).slice(-16);
  const preparedContext = prepareCampaignContext(adventure, dmState, action);
  const combatResult = handleCombatAction(db, player, mode, action);
  if (combatResult) return combatResult;
  if (resolveLocationQuestion(db,player,adventure,dmState,mode,action)) return {source:"rules"};
  if (resolveRepeatedPickup(db,player,mode,action,recentHistory)) return {source:"rules"};
  if (resolveUnsupportedConjuration(db, player, mode, action)) return { source:"rules" };
  if (resolveLanternArrivalAction(db,player,adventure,dmState,mode,action,preparedContext)) return {source:"rules"};
  if (resolveStructuredWorldAction(db, player, adventure, dmState, mode, action)) return { source: "rules" };
  const roomState = getPartyState(db, player.partyId, "dm") || dmState;
  if (resolveLanternBoundaryAction(db, player, adventure, roomState, mode, action, recentHistory)) return { source:"rules" };
  if (resolveAuthoredRoomMovement(db,player,adventure,roomState,mode,action)) return {source:"rules"};
  if (resolveOutOfRoomFeatureAction(db,player,adventure,roomState,mode,action)) return {source:"rules"};
  if (resolveLanternSpeech(db, player, adventure, dmState, mode)) return { source:"rules" };
  if (resolveLanternSourceSearch(db, player, adventure, dmState, mode, action)) return { source:"rules" };
  if (resolveKeyedDoorInteraction(db, player, adventure, mode, action, recentHistory)) return { source:"rules" };
  if (resolvePersistentContainerInteraction(db, player, adventure, mode, action, recentHistory)) return { source:"rules" };
  if (offerLanternRescueCheck(db, player, adventure, dmState, mode, action)) return { source:"rules" };
  if (offerLanternSafetyCheck(db, player, adventure, dmState, mode, action)) return { source:"rules" };
  if (offerLanternChamberCheck(db, player, adventure, dmState, mode, action, preparedContext)) return { source:"rules" };
  if (offerGeneralAbilityCheck(db, player, mode, action)) return { source:"rules" };
  if (mode === "ask") return resolveDmQuestion(db, player, action, preparedContext, playerSafeHistory);
  if (resolveAuthoritativeClueAction(db, player, adventure, dmState, action, preparedContext)) return { source: "rules" };
  if (resolveBriarwatchClueAction(db, player, adventure, dmState, action, preparedContext)) return { source:"rules" };
  if (!(await isOllamaReady())) return demoResolution(db, player, mode, action, dmState);

  try {
    const roomAuthority = authoredRouteContext(adventure?.id, getPartyState(db, player.partyId, "dm") || dmState);
    const roomGuardrail = roomAuthority
      ? `AUTHORITATIVE ROOM STATE: ${JSON.stringify(roomAuthority)}. This is physical ground truth. Keep every character in currentLocation until an explicit movement action uses one of its exits. Only currentFeatures are present or reachable. Other authored rooms and their contents do not exist in the current scene yet. Never move, inspect, use, reveal, hear through, or illustrate a feature belonging to another room. If a requested destination or feature is not currently reachable, say which visible exit or transition must be used first.`
      : "No authored room graph exists for this adventure. Preserve the latest established location in recentHistory and never invent a transition merely to continue movement.";
    const director = await ollamaChat([
      { role:"system", content:roomGuardrail },
      { role:"system", content:"Literal action semantics are mandatory in every adventure: finding or searching for an item only locates it. It does not pick up, apply, activate, consume, combine, or use it. Examining something does not operate it. Only perform those additional verbs when the player's newest action explicitly includes them." },
      { role:"system", content:"Complete every explicitly requested routine verb in the same response. In particular, 'unlock and open', 'open with the key', or equivalent wording leaves the object unlocked and fully open unless an already-established obstacle prevents it. Never split one routine compound action across duplicate turns." },
      { role:"system", content:"Audience tags in recentHistory are authoritative. Speech recorded as 'says quietly to the party' is private in-character conversation among the player characters: NPCs and creatures did not hear it, must not react to it, and must not learn its contents unless a character later repeats it aloud. Never impersonate or answer for another player character." },
      { role:"system", content:"Cotton, formally Sir Cotton Woltanade Floof the 67th, is the party's miserable Ragdoll-cat companion and a god in cat form. He is immortal and automatically evades every attack or harmful effect. A separate companion system controls his restrained cat reactions and combat abilities: never speak for him, choose actions for him, make him solve puzzles, reveal secrets, or use him to advance exploration." },
      { role: "system", content: "You are the hidden Dungeon Master for a revised 2024 D&D campaign. Resolve the newest action using recent history and the secret adventure bible; continuity and discovery pacing are mandatory. Everything in the adventure bible is hidden by default. Treat clueChain as an ordered progression and obey revelationGates exactly. Reveal a clue only after its prerequisite action has actually occurred in recentHistory; never dump later clues merely because you know them. The supplied current campaign context is authoritative when recent narration contradicts it; do not preserve an invented object, route, location, or threat merely because a previous model mentioned it. Respect the literal scope of the player's verb: inspect/examine/look does not open, break, activate, consume, enter, or move an object unless explicitly stated. If wording is ambiguous, choose the least invasive reasonable interpretation and leave the consequential choice to the player. Be concrete, causal, and fair within that scope. Do not invent an NPC, creature, threat, trap, object, rule, motive, or complication unless it is present in the adventure bible or already established by the authoritative campaign context. Atmospheric sensory detail is allowed only when it does not introduce a new fact or obstacle. A movement action must do exactly one of three things: arrive at one established location and set locationName, stop at an already-established physical obstruction, or plainly state that no farther route is currently accessible. Never respond to movement merely by saying the character goes deeper while a sound, smell, darkness, pressure, or danger grows stronger ahead. If the player asks a direct factual question about something they can currently read, see, or have already uncovered, answer directly—never replace an available answer with 'cryptic', 'vague', or 'mysterious'. If the information is still sealed, hidden, or gated, state the observable obstruction rather than revealing it. Resolve routine unopposed actions decisively. Require a check only when failure is plausible and interesting; put the exact ability or skill and DC in requiredCheck and the stakes in checkReason, otherwise use empty strings. When a check is required, do not decide success before a roll appears in history. publicFacts must contain 1–3 specific player-perceivable facts, normally revealing no more than one new clue stage per action. inventoryChanges records only completed physical transfers explicitly requested in the newest action and confirmed by publicFacts: add an item actually picked up, received, or collected; remove one actually dropped, given away, discarded, lost, or destroyed. Merely inspecting, touching, using, lighting, opening, or noticing an item does not transfer it. Never add scenery automatically. Use an empty array when inventory did not change. Do not repeat previous narration. privateFact is only for a useful perception unique to the acting character, otherwise empty; it must not restate publicFacts or bypass a revelation gate. hiddenNote is the sealed continuity ledger. Set adventureComplete only when the central conflict truly ends. locationName and locationNote are only for a distinct place the party enters or clearly learns about. Never leak hidden facts into player-facing fields." },
      { role: "user", content: JSON.stringify({ adventure, party, actingPlayer: player, mode, newestAction: action, recentHistory: directorHistory, availableCampaignContext: preparedContext.state }) },
    ], directorSchema, { temperature:0.42, numPredict:620 });
    validateAuthoredDestination(db,player,adventure,{...dmState,clueStage:preparedContext.nextClueStage},director);

    const guidanceMode = getGuidanceMode(db, player.partyId);
    const requestGuidance = guidanceMode === "guided" || (guidanceMode === "standard" && appearsStalled(recentHistory));
    const narrator = await ollamaChat([
      { role:"system", content:roomGuardrail },
      { role: "system", content: "You narrate a tabletop fantasy adventure aloud using only player-safe information. Write 2–4 clear sentences, usually 45–95 words. The first sentence must directly state the result of the newest action within its exact scope. Include concrete sensory details or wording supplied in the facts, but reveal no more than the facts contain and never infer the next clue. Inspecting a closed object keeps it closed; noticing an entrance does not enter it. Do not repeat recent descriptions. Never use atmosphere as a substitute for information, and never call currently readable words merely cryptic or vague. If requiredCheck is nonempty, ask for that exact check and explain its stakes without narrating the result. Otherwise resolve routine actions decisively. End at the immediate choice created by this result, not at a later discovery. Never invent hidden motives, routes, identities, traps, or outcomes beyond the supplied facts. When requestGuidance is true, provide 2 or 3 optional suggestions based exclusively on visible facts and the character profile. Suggestions may propose a sensible check, direct examination, conversation, movement, item use, or class skill, but must never imply which choice is correct or reveal that a hidden thing exists. Each suggestion needs a short label, text ready to place in the player's input, the appropriate act/speak/ask mode, and a plain reason. When requestGuidance is false, suggestions must be an empty array. Do not mention being an AI." },
      { role: "user", content: JSON.stringify({ adventureTitle: adventure?.title, playerName: player.name, character:{className:player.className,level:player.level,abilities:player.abilities,skills:player.skills,spellcasting:player.spellcasting,inventory:player.inventory.map((item)=>({name:item.name,quantity:item.quantity,status:item.status}))}, newestAction: action, recentVisibleHistory: playerSafeHistory, perceivableFacts: director.publicFacts, requiredCheck:director.requiredCheck, checkReason:director.checkReason, requestGuidance }) },
    ], narrationSchema, { temperature:0.58, numPredict:360 });

    const concreteNarration = ensureCompleteContainerResult(player.name,action,ensureConcreteMovementResult(player.name, action, director, narrator.narration));
    addEvent(db, { partyId: player.partyId, visibility: "public", kind: "narration", speaker: "Dungeon Master", text: concreteNarration });
    if(String(adventure?.id || "").endsWith("ashes-briarwatch")) setPlayerGuidance(db,player.id,player.partyId,ASHES_GUIDANCE[Math.max(0,Math.min(6,Number(preparedContext.nextClueStage || 0)))] || []);
    else setPlayerGuidance(db, player.id, player.partyId, requestGuidance ? safeNarratorSuggestions(narrator.suggestions) : []);
    const privateFact = String(adventure?.id || "").endsWith("lantern-below") ? "" : director.privateFact;
    if (privateFact) addEvent(db, { partyId: player.partyId, visibility: "player", playerId: player.id, kind: "narration", speaker: "Dungeon Master", text: privateFact });
    if (director.hiddenNote) addEvent(db, { partyId: player.partyId, visibility: "dm", kind: "system", speaker: "DM Ledger", text: director.hiddenNote });
    const explicitInventoryChange = applyExplicitInventoryLanguage(db, player, adventure, action, recentHistory, director.publicFacts);
    if (!explicitInventoryChange) applyResolvedInventoryChanges(db, player, adventure, action, director.publicFacts, director.inventoryChanges);
    recordContainerInteraction(db,player,adventure,action,concreteNarration);
    if (director.locationName) rememberKnownLocation(db, player.partyId, { name: director.locationName, summary: director.locationNote });
    const latestState=getPartyState(db,player.partyId,"dm") || dmState;
    setPartyState(db, player.partyId, "dm", { ...latestState, lanternArrivalStage:Math.max(lanternArrivalStage(latestState),Number(preparedContext.nextLanternArrivalStage ?? lanternArrivalStage(latestState))), clueStage:Math.max(Number(latestState.clueStage||0),Number(preparedContext.nextClueStage||0)), dangerClock: Math.max(0, Number(latestState.dangerClock || 0) + director.dangerChange) });
    if (director.adventureComplete) completeActiveAdventure(db, player.partyId);
    return { source: "ollama" };
  } catch (error) {
    console.warn("Local AI resolution failed; using demo DM:", error.message);
    return demoResolution(db, player, mode, action, dmState);
  }
}

function demoResolution(db, player, mode, action, dmState) {
  const lower = action.toLowerCase();
  let narration;
  let privateText = "";
  let hidden = "The party acted while the demo DM was active; review this beat when the local model is connected.";
  if (lower.includes("letter") || lower.includes("seal") || lower.includes("wax")) {
    narration = `${player.name} draws the letter closer. The silver moth seal is cold enough to mist the air, and the faint scratching beneath it stops the instant a finger touches the envelope. Around you, the common room carries on as though nothing unusual has happened.`;
    privateText = "At the edge of the wax, you notice a hair-thin line of fresh black ink pointing toward the inn's pantry.";
    hidden = "The acting character noticed the first trace left by the ink-mite; the cellar route remains concealed.";
    rememberKnownLocation(db, player.partyId, { name: "The Crooked Lantern", summary: "A rain-soaked inn where a sealed silver-moth letter appeared without explanation." });
  } else if (mode === "speak") {
    narration = `For a heartbeat after ${player.name}'s words, the nearest flame bends toward the company. Someone nearby glances over, then quickly finds great interest in an empty cup. Whatever happens next, the room is listening.`;
  } else if (mode === "ask") {
    narration = `The Dungeon Master considers the question. From where ${player.name} stands, several careful approaches remain open; a deliberate investigation may reveal more than a hurried one.`;
  } else {
    narration = `${player.name} acts, and the world seems to hold its breath. A distant floorboard answers with a soft creak while a nearby shadow shifts against the light. What does the company do?`;
  }
  addEvent(db, { partyId: player.partyId, visibility: "public", kind: "narration", speaker: "Dungeon Master", text: narration });
  if (privateText) addEvent(db, { partyId: player.partyId, visibility: "player", playerId: player.id, kind: "narration", speaker: "Dungeon Master", text: privateText });
  addEvent(db, { partyId: player.partyId, visibility: "dm", kind: "system", speaker: "DM Ledger", text: hidden });
  setPartyState(db, player.partyId, "dm", { ...dmState, dangerClock: (dmState.dangerClock || 0) + 1 });
  return { source: "demo" };
}

export const dmModel = MODEL;
