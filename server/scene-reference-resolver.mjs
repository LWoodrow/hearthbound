import { parseLiteralIntent, resolveEntityReferences } from "./intent-resolver.mjs";

function typed(entity, entityType, aliases = []) {
  return { ...entity, entityType, aliases:[...(entity.aliases || []), ...aliases].filter(Boolean) };
}

export function sceneEntityPool(surface, intent) {
  const exits = (surface.exits || []).map((entry) => typed(entry, "exit", [entry.destination, entry.via, entry.direction]));
  const features = (surface.visibleFeatures || []).map((entry) => typed(entry, "feature"));
  const npcs = (surface.presentNpcs || []).map((entry) => typed({ ...entry, label:entry.name }, "npc"));
  const inventory = (surface.carriedItems || []).map((entry) => typed({ ...entry, label:entry.name }, "inventory-item"));
  if (intent === "move") return exits;
  if (intent === "speak") return npcs;
  if (intent === "take") return features.filter((entry) => entry.kind === "item");
  if (intent === "open" || intent === "use") return [...features, ...inventory, ...exits.filter((entry) => entry.objectId)];
  if (intent === "observe") return [...features, ...npcs, ...inventory, ...exits];
  return [...features, ...inventory, ...npcs, ...exits];
}

export function resolveSceneReference({ surface, action, mode = "act", intent = null }) {
  const parsed = intent ? { ...parseLiteralIntent(action, mode), verb:intent } : parseLiteralIntent(action, mode);
  const pool = sceneEntityPool(surface, parsed.verb);
  const resolution = resolveEntityReferences(action, pool);
  const priority = parsed.verb === "observe"
    ? { feature:4, npc:3, "inventory-item":2, exit:1 }
    : (parsed.verb === "open" || parsed.verb === "use")
      ? { feature:3, "inventory-item":2, exit:1 }
      : {};
  const ranked = [...resolution.candidates].sort((left, right) => right.confidence - left.confidence
    || (priority[right.entityType] || 0) - (priority[left.entityType] || 0)
    || String(left.id).localeCompare(String(right.id)));
  const selected = ranked[0] && (!ranked[1]
    || ranked[0].confidence > ranked[1].confidence
    || (priority[ranked[0].entityType] || 0) > (priority[ranked[1].entityType] || 0))
    ? ranked[0]
    : null;
  return { intent:parsed.verb, pool, selected, candidates:ranked, rejected:ranked.filter((entry) => entry.id !== selected?.id) };
}
