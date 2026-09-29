// A deliberately finite, reviewed NPC portrait set. Adventures choose an ID;
// the client never invents a face for an unnamed or unrevealed character.
export const NPC_PORTRAIT_INDEX = Object.freeze({
  tamsin: 0,
  mara: 1,
  cotton: 2,
  "ink-guardian": 3,
});

export function visibleNpcPortraits(definition, events = []) {
  const appeared = new Set(events.map((event) => event.speaker));
  return Object.fromEntries(Object.values(definition?.story?.npcs || {})
    .filter((npc) => Object.hasOwn(NPC_PORTRAIT_INDEX, npc.portraitId) && appeared.has(npc.name))
    .map((npc) => [npc.name, npc.portraitId]));
}
