// A deliberately finite, reviewed NPC portrait set. Adventures choose an ID;
// the client never invents a face for an unnamed or unrevealed character.
import {playerPortrait} from "./player-portraits.mjs";

// Explicit, story-reviewed assignments from existing approved artwork. These
// NPC IDs are independent of player selections: no randomisation or save edits.
export const NPC_PORTRAIT_CROPS = Object.freeze(Object.fromEntries([
  ["sable","tiefling-female-v1"],["torra","dwarf-female-v1"],
  ["varek","dragonborn-male-v1"],["pip","halfling-male-v1"],
  ["nim","gnome-male-v1"],["ruka","orc-female-v1"],
  ["korrin","goliath-male-v1"],["lethiel","mystic"],
  ["seren","aasimar-female-v1"],["borin","dwarf-male-v1"],
].map(([id,sourceId]) => {
  const portrait = playerPortrait(sourceId);
  if (!portrait) throw new Error("Unapproved NPC portrait source: " + sourceId);
  return [id,Object.freeze({sourceId,file:portrait.file,size:portrait.size,position:portrait.position,species:portrait.species,gender:portrait.gender})];
})));
export const NPC_PORTRAIT_INDEX = Object.freeze({
  tamsin: 0,
  mara: 1,
  cotton: 2,
  "ink-guardian": 3,
});

// Individual portraits need no sprite-sheet repacking when a settlement grows.
export const NPC_PORTRAIT_FILES=Object.freeze({
  jory:"/art/portraits/stonecross-jory-v1.png",
  mira:"/art/portraits/stonecross-mira-v1.png",
  edda:"/art/portraits/stonecross-edda-v1.png",
  bran:"/art/portraits/stonecross-bran-v1.png",
  elin:"/art/portraits/rivergate-elin-v1.png",
  dain:"/art/portraits/rivergate-dain-v1.png",
  vera:"/art/portraits/rivergate-vera-v1.png",
  osric:"/art/portraits/rivergate-osric-v1.png",
  nella:"/art/portraits/rivergate-nella-v1.png",
  harlan:"/art/portraits/rivergate-harlan-v1.png",
  merrin:"/art/portraits/willowford-merrin-v1.png",
  ada:"/art/portraits/willowford-ada-v1.png",
  bessa:"/art/portraits/willowford-bessa-v1.png",
  fen:"/art/portraits/willowford-fen-v1.png",
  tobin:"/art/portraits/willowford-tobin-v1.png",
  cora:"/art/portraits/willowford-cora-v1.png",
});

export function npcPortraitStyle(id) {
  const crop = Object.hasOwn(NPC_PORTRAIT_CROPS,id) ? NPC_PORTRAIT_CROPS[id] : undefined;
  if (crop) return {backgroundImage:`url(${crop.file})`,backgroundSize:crop.size,backgroundPosition:crop.position};
  const file = Object.hasOwn(NPC_PORTRAIT_FILES,id) ? NPC_PORTRAIT_FILES[id] : undefined;
  if (file) return {backgroundImage:`url(${file})`,backgroundSize:"cover",backgroundPosition:"center"};
  const index = Object.hasOwn(NPC_PORTRAIT_INDEX,id) ? NPC_PORTRAIT_INDEX[id] : undefined;
  return index === undefined ? undefined : {backgroundImage:"url(/art/portraits/npc-portraits-v1.png)",backgroundSize:"400% 133.333%",backgroundPosition:`${index % 4 * 100 / 3}% 50%`};
}

export function visibleNpcPortraits(definition, events = []) {
  const appeared = new Set(events.map((event) => event.speaker));
  return Object.fromEntries(Object.values(definition?.story?.npcs || {})
    .filter((npc) => Boolean(npcPortraitStyle(npc.portraitId)) && appeared.has(npc.name))
    .map((npc) => [npc.name, npc.portraitId]));
}

// Public, authored introductions only. Never expose knows/goals/conditional facts.
const publicIntroductions = Object.freeze({
  tamsin: "Tamsin Reed keeps the Crooked Lantern. She offers travellers food, drink and a place to rest, with a practical welcome and little patience for unnecessary fuss.",
  mara: "Mara Vey is a surveyor of the old roads. Her work involves recording the marks and passages left by earlier travellers.",
  merrin: "Merrin Holt is the welcoming host of the Willow Cup, a timber inn in Willowford where travellers can pause beside the kitchen garden.",
  ada: "Ada Flint works at Willowford's smithy. She is a confident, practical craftswoman who values sound tools and honest work.",
  bessa: "Bessa Thorn tends Willowford's orchard. Years outdoors have given her a weathered face, a patient manner and a perceptive eye.",
  fen: "Sister Fen tends the village shrine. She offers visitors a gentle welcome and a quiet place to pause beside the road.",
  tobin: "Tobin works at Willowford's river landing, part of the village's everyday connection to the river roads.",
  cora: "Cora works at Willowford's coach yard, helping travellers find their way along the established carriage routes.",
  elin: "Elin Marr carries ordinary letters between river settlements. Quick-witted and practical, she sorts her deliveries at Rivergate Market.",
  dain: "Dain Mercer oversees Rivergate's quay. A calm, fair dockmaster, he keeps the working riverfront moving with few wasted words.",
  harlan: "Harlan Moss keeps Rivergate's bonded warehouse. Cautious and direct, he takes the care of other people's goods seriously.",
  vera: "Vera Senn works at Rivergate's records office. Patient and precise, she keeps the market's paperwork in order.",
  osric: "Osric Vale hosts Rivergate's Blue Heron inn, a resting place for people travelling along the river roads.",
  nella: "Nella Brind is Rivergate's baker. Her bakehouse is part of the market town's daily bustle.",
});

export function visibleNpcProfiles(definition, events = []) {
  const portraits = visibleNpcPortraits(definition, events);
  return Object.fromEntries(Object.values(definition?.story?.npcs || {})
    .filter(npc => Object.hasOwn(portraits, npc.name))
    .map(npc => [npc.name, {
      name: npc.name, portraitId: portraits[npc.name],
      background: typeof npc.publicBackground === "string" ? npc.publicBackground : publicIntroductions[npc.portraitId] || "No background has been recorded yet.",
    }]));
}
