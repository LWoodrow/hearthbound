import { observationReferenceText, parseLiteralIntent, resolveEntityReferences } from "./intent-resolver.mjs";
import { textTokens, tokenEquivalent } from "./semantic-tokens.mjs";

function typed(entity, entityType, aliases = []) {
  return { ...entity, entityType, aliases:[...(entity.aliases || []), ...aliases].filter(Boolean) };
}

export function sceneEntityPool(surface, intent) {
  const exits = (surface.exits || []).map((entry) => typed(entry, "exit", [entry.destination, entry.via, entry.direction, entry.objectName, ...(entry.signposts || [])]));
  const features = (surface.visibleFeatures || []).map((entry) => typed(entry, "feature"));
  const npcs = (surface.presentNpcs || []).map((entry) => typed({ ...entry, label:entry.name }, "npc"));
  const inventory = (surface.carriedItems || []).map((entry) => typed({ ...entry, label:entry.name }, "inventory-item"));
  const localItems = (surface.localPortableItems || []).map((entry) => typed({ ...entry, label:entry.name }, "local-item"));
  if (intent === "move") return exits;
  if (intent === "speak") return (surface.hearableNpcs || surface.presentNpcs || []).map((entry) => typed({...entry, label:entry.name}, "npc"));
  if (intent === "take") return localItems;
  if (intent === "open" || intent === "use") return [...features, ...localItems, ...inventory, ...exits.filter((entry) => entry.objectId)];
  if (intent === "observe") return [...features, ...localItems, ...npcs, ...inventory, ...exits];
  return [...features, ...localItems, ...inventory, ...npcs, ...exits];
}

export function resolveSceneReference({ surface, action, mode = "act", intent = null, parsed:preparsed = null }) {
  const parsed = intent ? { ...(preparsed || parseLiteralIntent(action, mode)), verb:intent } : (preparsed || parseLiteralIntent(action, mode));
  let pool = sceneEntityPool(surface, parsed.verb);
  if (parsed.verb === "move") {
    const words = textTokens(action);
    const kind = ["door", "hatch", "stairs", "gate", "entrance"].find((word) => words.includes(word));
    if (kind) {
      const matching = pool.filter((exit) => textTokens(`${exit.via} ${exit.objectName || ""}`)
        .some((word) => tokenEquivalent(word, kind)));
      if (matching.length) pool = matching;
    }
    if (words.some((word) => tokenEquivalent(word, "opened"))) {
      const opened = pool.filter((exit) => exit.objectOpen);
      if (opened.length) pool = opened;
    }
  }
  const referenceText = parsed.verb === "observe" ? observationReferenceText(action) : action;
  const resolution = resolveEntityReferences(referenceText, pool);
  const priority = parsed.verb === "observe"
    ? { feature:5, "local-item":4, npc:3, "inventory-item":2, exit:1 }
    : (parsed.verb === "open" || parsed.verb === "use")
      ? { feature:3, "inventory-item":2, exit:1 }
      : {};
  const ranked = [...resolution.candidates].sort((left, right) => right.confidence - left.confidence
    || (priority[right.entityType] || 0) - (priority[left.entityType] || 0)
    || String(left.id).localeCompare(String(right.id)));
  const directCandidates = parsed.verb === "speak" ? ranked.filter((entry)=>textTokens(action)[0] === textTokens(entry.name)[0]) : [];
  const directAddressee = directCandidates.length === 1 ? directCandidates[0] : null;
  const selected = directAddressee || (ranked[0] && (!ranked[1]
    || ranked[0].confidence > ranked[1].confidence
    || (priority[ranked[0].entityType] || 0) > (priority[ranked[1].entityType] || 0))
    ? ranked[0]
    : null);
  return { intent:parsed.verb, pool, selected, candidates:ranked, rejected:ranked.filter((entry) => entry.id !== selected?.id) };
}
