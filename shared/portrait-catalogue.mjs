// A deliberately finite, reviewed NPC portrait set. Adventures choose an ID;
// the client never invents a face for an unnamed or unrevealed character.
export const NPC_PORTRAIT_INDEX = Object.freeze({
  tamsin: 0,
  mara: 1,
  cotton: 2,
  "ink-guardian": 3,
});

// Individual portraits need no sprite-sheet repacking when a settlement grows.
export const NPC_PORTRAIT_FILES=Object.freeze({
  merrin:"/art/portraits/willowford-merrin-v1.png",
  ada:"/art/portraits/willowford-ada-v1.png",
  bessa:"/art/portraits/willowford-bessa-v1.png",
  fen:"/art/portraits/willowford-fen-v1.png",
  tobin:"/art/portraits/willowford-tobin-v1.png",
  cora:"/art/portraits/willowford-cora-v1.png",
});

export function visibleNpcPortraits(definition, events = []) {
  const appeared = new Set(events.map((event) => event.speaker));
  return Object.fromEntries(Object.values(definition?.story?.npcs || {})
    .filter((npc) => (Object.hasOwn(NPC_PORTRAIT_INDEX, npc.portraitId)||Object.hasOwn(NPC_PORTRAIT_FILES,npc.portraitId)) && appeared.has(npc.name))
    .map((npc) => [npc.name, npc.portraitId]));
}
