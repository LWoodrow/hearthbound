import lanternBelow from "./adventures/lantern-below.mjs";
import { assertValidAdventure } from "./adventure-schema.mjs";

const definitions = [lanternBelow];
definitions.forEach(assertValidAdventure);

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function allAdventureDefinitions() {
  return [...definitions];
}

export function adventureDefinition(adventure) {
  if (!adventure) return null;
  if (typeof adventure === "string") adventure = { id: adventure };
  const candidates = [
    adventure.id,
    adventure.adventureId,
    adventure.slug,
    adventure.title,
    adventure.name,
  ].map(normalise).filter(Boolean);
  return definitions.find((definition) => {
    const id = normalise(definition.id);
    const title = normalise(definition.title);
    return candidates.some((candidate) => candidate === id || candidate === title || candidate.endsWith(id));
  }) || null;
}
