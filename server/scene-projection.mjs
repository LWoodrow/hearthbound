import { requirementsMet, visibleLocationDescription, visibleLocationFeatures } from "./world-state.mjs";

// Project current facts, never the source definition's default/pre-event prose.
export function projectScene(definition, world) {
  const location = definition.locations?.[world.currentLocation];
  if (!location) return null;
  return {
    name: location.name,
    description: visibleLocationDescription(definition, world),
    occupants:[...(location.occupants || [])],
    visibleFeatures: visibleLocationFeatures(definition, world).map(({id,label,kind}) => ({id,label,kind})),
    exits: (location.exits || []).filter((exit) => {
      const object = exit.object && world.objects?.[exit.object];
      return object?.discovered !== false && requirementsMet(world, exit.requires || []);
    }).map(({to,via}) => ({to,via})),
  };
}

export function projectNpc(npc, world) {
  const presentation = (npc.presentations || []).find((entry) => requirementsMet(world, entry.requires || []));
  const facts = [
    ...(npc.conversation?.publicFacts || []),
    ...(npc.conversation?.conditionalFacts || []).filter((entry) => requirementsMet(world, entry.requires || [])).map((entry) => entry.fact),
  ];
  return {
    name:npc.name, role:npc.role, appearance:presentation?.appearance || npc.appearance,
    goals:presentation?.goals || npc.goals, voice:presentation?.voice || npc.voice,
    mustNotKnow:npc.mustNotKnow, facts, authoredReply:presentation?.reply,
  };
}

export function supportedNpcOutput(output, facts) {
  return typeof output?.reply === "string" && Array.isArray(output.usedFacts)
    && output.usedFacts.every((fact) => facts.includes(fact));
}
