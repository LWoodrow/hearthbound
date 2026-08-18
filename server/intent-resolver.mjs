const normalise = (value) => String(value || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const words = (value) => normalise(value).split(" ").filter(Boolean);

const VERB_FAMILIES = {
  observe:["look","inspect","examine","study","search","investigate","read","check"],
  move:["go","move","enter","follow","sneak","slip","creep","walk","descend","ascend","leave","return"],
  open:["open","unseal","break","unlock","unfasten"],
  use:["use","warm","heat","offer","give","apply","operate","place"],
  speak:["ask","tell","say","show","request","question","interrogate"],
  take:["take","collect","grab","pickup","retrieve"],
};

function phrasePresent(action, phrase) {
  const haystack = normalise(action);
  const needle = normalise(phrase);
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  const actionWords = new Set(words(action));
  const meaningful = words(phrase).filter((word) => word.length > 3);
  return meaningful.length > 0 && meaningful.every((word) => actionWords.has(word));
}

function entityScore(action, entity) {
  const aliases = [entity.id, entity.name, entity.label, ...(entity.aliases || [])].filter(Boolean);
  let score = 0;
  for (const alias of aliases) {
    if (normalise(action).includes(normalise(alias))) score = Math.max(score, 1);
    else {
      const overlap = words(alias).filter((word) => word.length > 3 && words(action).includes(word)).length;
      if (overlap) score = Math.max(score, Math.min(.9, overlap / Math.max(1, words(alias).length)));
    }
  }
  return score;
}

export function parseLiteralIntent(action, mode = "act") {
  const actionWords = words(action);
  const explicit = mode === "speak" ? "speak" : Object.entries(VERB_FAMILIES)
    .find(([, verbs]) => verbs.some((verb) => actionWords.includes(verb)))?.[0] || "other";
  const quantity = Number(actionWords.find((word) => /^\d+$/.test(word)) || 1);
  const compound = actionWords.filter((word) => Object.values(VERB_FAMILIES).flat().includes(word)).length > 1
    && /\b(and|then|after|before)\b/.test(normalise(action));
  return { mode, verb:explicit, literal:String(action || "").trim(), quantity, compound };
}

export function resolveEntityReferences(action, entities = []) {
  const candidates = entities.map((entity) => ({ ...entity, confidence:entityScore(action, entity) }))
    .filter((entity) => entity.confidence > 0)
    .sort((a,b) => b.confidence - a.confidence || String(a.id).localeCompare(String(b.id)));
  const selected = candidates[0] && (!candidates[1] || candidates[0].confidence > candidates[1].confidence)
    ? candidates[0]
    : null;
  return { selected, candidates, rejected:candidates.filter((candidate) => candidate.id !== selected?.id) };
}

export function interactionMatch(interaction, action, mode = "act") {
  const parsed = parseLiteralIntent(action, mode);
  const verbs = interaction.verbs || [];
  const modeMatch = !interaction.modes?.length || interaction.modes.includes(mode);
  const verbMatch = verbs.some((verb) => words(verb).every((word) => words(action).includes(word)));
  const targets = [...(interaction.targets || []), ...(interaction.representations || [])];
  const target = resolveEntityReferences(action, targets.map((name, index) => ({ id:`target:${index}`, name })));
  const instrument = interaction.instruments?.length
    ? resolveEntityReferences(action, interaction.instruments.map((name, index) => ({ id:`instrument:${index}`, name })))
    : { selected:{ id:"instrument:none", confidence:1 }, candidates:[], rejected:[] };
  const matchAll = (interaction.matchAll || []).every((group) => group.some((alias) => phrasePresent(action, alias)));
  const exactTargetMatch = targets.some((targetName) => phrasePresent(action, targetName));
  const exactInstrumentMatch = (interaction.instruments || []).some((instrumentName) => phrasePresent(action, instrumentName));
  // These lists are aliases for one authored role, not separate world
  // entities. A tie between aliases must not make the interaction ambiguous.
  // A single weak overlap (for example "some" in "some drinks" versus
  // "some privacy") can never trigger a consequential story transition.
  const targetMatch = exactTargetMatch || Boolean(target.selected && target.selected.confidence > .5);
  const instrumentMatch = !interaction.instruments?.length
    || exactInstrumentMatch
    || Boolean(instrument.selected && instrument.selected.confidence > .5);
  return { parsed, modeMatch, verbMatch, targetMatch, instrumentMatch, groupMatch:matchAll, target, instrument };
}
