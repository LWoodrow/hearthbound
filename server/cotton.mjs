import { addEvent, getPartyState, listPlayers, setPartyState } from "./database.mjs";

export const COTTON_ID = "divine-companion-cotton";
export const COTTON_FULL_NAME = "Sir Cotton Woltanade Floof the 67th";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MODEL = process.env.DND_MODEL || "qwen3:14b-q4_K_M";

export function cottonLevel(db, partyId) {
  const party = listPlayers(db, partyId);
  return Math.max(1, Math.round(party.reduce((sum, member) => sum + Number(member.level || 1), 0) / Math.max(1, party.length)));
}

export function cottonForParty(db, partyId) {
  const party = listPlayers(db, partyId);
  const level = cottonLevel(db, partyId);
  const partyInfo = party[0];
  return {
    id:COTTON_ID, worldId:partyInfo?.worldId || "", partyId, name:"Cotton", fullName:COTTON_FULL_NAME,
    isCompanion:true, divine:true, className:"God in cat form", species:"Ragdoll cat", background:"Unseen Beans", alignment:"Cat",
    abilities:{ strength:10, dexterity:30, constitution:30, intelligence:18, wisdom:22, charisma:16 }, skills:["Perception","Stealth","Insight"], expertise:["Stealth"], subclass:"", classFeatures:[], equipmentChoice:"none",
    backstory:"An unknowable god wearing the shape and temperament of a miserable Ragdoll cat.", appearance:"A magnificent blue-eyed Ragdoll cat who regards affection as a personal insult.",
    level, experience:0, hp:1, maxHp:1, armorClass:99, spellcasting:null, inventory:[],
  };
}

export function cottonCombatant(db, partyId) {
  const level = cottonLevel(db, partyId);
  return { id:COTTON_ID, name:"Cotton", type:"companion", initiative:10 + Math.ceil(level / 2), initiativeModifier:10, level };
}

const fallbackLines = {
  touch:[
    "Cotton flattens his ears, twists bonelessly out of reach, and looks personally betrayed by the attempt.",
    "Cotton evades the hand before it arrives and issues one low, miserable complaint.",
  ],
  addressed:[
    "Cotton stares back in grave silence, then deliberately turns his head away.",
    "Cotton answers with a short, displeased chirrup that somehow sounds judgmental.",
  ],
  environment:[
    "Cotton investigates the least useful corner, bats once at something invisible, and pretends this was important.",
    "Cotton sniffs the air, steps over the obvious route, and sits directly where somebody will want to stand.",
    "Cotton's attention fixes on a tiny movement nobody else noticed; a moment later he loses interest completely.",
    "Cotton scratches at {actor}'s bag, then looks offended when it fails to open itself.",
    "Cotton waits to be let out, despite refusing to indicate which way out is.",
    "Cotton wants biscuits and makes this everybody else's problem.",
    "Cotton remembers that he likes creamies and stares accusingly at the party.",
    "Cotton shows his toe beans for exactly one second, then hides them again.",
    "Cotton lifts one leg high and licks himself with solemn, inconvenient concentration.",
  ],
};

export function isCottonInteraction(action) {
  const text = String(action || "").toLowerCase();
  if (/\b(cotton|woltanade|floof)\b/.test(text)) return true;
  return /\b(pick up|stroke|pet|cuddle|hug|lap|carry|hold|tickle)\b/.test(text) && /\b(the cat|cat|him)\b/.test(text);
}

function cottonTrigger(mode, audience, action, state) {
  const text = String(action || "").toLowerCase();
  if (/\b(pick up|stroke|pet|cuddle|hug|lap|carry|hold|tickle)\b/.test(text) && /\b(cotton|cat|him)\b/.test(text)) return "touch";
  if (/\b(cotton|woltanade|floof)\b/.test(text)) return "addressed";
  const nextCount = Number(state.actionCount || 0) + 1;
  const sinceLast = nextCount - Number(state.lastInterjectionAction || 0);
  if (sinceLast >= 3 && mode === "speak" && audience === "party" && Math.random() < .24) return "environment";
  if (sinceLast >= 4 && mode === "act" && Math.random() < .16) return "environment";
  return "";
}

async function aiCottonLine(trigger, action) {
  try {
    const prompt = `Write one sentence, 8-28 words, describing Cotton's reaction. Cotton is ${COTTON_FULL_NAME}, an immortal god disguised as a miserable blue-eyed Ragdoll cat. He hates being picked up, stroked, cuddled, or treated as a lap cat. He behaves playfully like a real cat but never solves puzzles, reveals secrets, leads exploration, speaks human language, or changes the scene. Use no dialogue and no quoted words: only observable cat behaviour. His roster name is Cotton. Trigger: ${trigger}. Family player's latest words/action: ${String(action).slice(0,300)}`;
    const response = await fetch(`${OLLAMA_URL}/api/chat`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:MODEL, messages:[{role:"system",content:"Return strict JSON with one field named line. No markdown."},{role:"user",content:prompt}], stream:false, think:false, format:{type:"object",properties:{line:{type:"string"}},required:["line"]}, options:{temperature:.78,num_predict:70} }), signal:AbortSignal.timeout(12000) });
    if (!response.ok) return "";
    const line = String(JSON.parse((await response.json()).message.content)?.line || "").trim().slice(0,260);
    if (/[\"“”]|'\s*(?:what|i|you|we|no|yes|feed|leave)\b/i.test(line) || /\b(?:says?|asks?|replies?|whispers?)\b/i.test(line)) return "";
    return line;
  } catch { return ""; }
}

export async function maybeCottonInterjection(db, player, mode, audience, action) {
  const state = getPartyState(db, player.partyId, "cotton") || {};
  const trigger = cottonTrigger(mode, audience, action, state);
  const nextCount=Number(state.actionCount || 0)+1;
  const touched=trigger === "touch";
  setPartyState(db, player.partyId, "cotton", { ...state, actionCount:nextCount, lastInterjectionAction:trigger ? nextCount : state.lastInterjectionAction || 0, mood:touched ? "deeply offended" : "miserable", grudgeCount:Number(state.grudgeCount || 0)+(touched?1:0), lastInteraction:String(action || "").slice(0,180) });
  if (!trigger) return false;
  const lines = fallbackLines[trigger] || fallbackLines.environment;
  const fallback = lines[(Number(state.actionCount || 0)) % lines.length].replaceAll("{actor}", player.name);
  const line = await aiCottonLine(trigger, action) || fallback;
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Cotton", text:line, payload:{ companion:COTTON_ID, audience:mode === "speak" && audience === "party" ? "party" : "scene" } });
  return true;
}
