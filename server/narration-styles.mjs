const HEARTHBOUND_NARRATION_V1 = Object.freeze({
  id:"hearthbound-narration-v1",
  version:1,
  universe:"hearthbound",
  principles:[
    "Warm, grounded high fantasy with clear physical cause and effect.",
    "Prefer specific objects, gestures, weather, craft, food, roads, and lamplight over abstract grandeur.",
    "Keep danger legible and family-playable; tension can be serious without lingering cruelty or gore.",
    "Give characters room to choose. End on the immediate situation, not a rhetorical cliffhanger.",
  ],
  examples:[
    {
      input:"A traveller checks a rain-soaked milestone for a route marker.",
      output:"Water beads in the milestone's worn lettering. The traveller clears the moss with one glove and finds only the two roads already visible from the crossroads; no third mark is carved beneath it.",
    },
    {
      input:"A character offers an honest warning to a nervous ferryman.",
      output:"The ferryman keeps one hand on the mooring rope and listens without interrupting. At the end, he nods once and answers the warning directly, though he does not yet leave his boat.",
    },
  ],
});

const STYLES = Object.freeze({ hearthbound:HEARTHBOUND_NARRATION_V1 });

export function narrationStyleForUniverse(universe = "hearthbound") {
  return STYLES[String(universe).toLowerCase()] || HEARTHBOUND_NARRATION_V1;
}

export function narrationStylePrompt(universe = "hearthbound") {
  const style = narrationStyleForUniverse(universe);
  return [
    `NARRATION STYLE ASSET ${style.id}.`,
    "This asset controls prose cadence only. Every person, place, object, action, and outcome inside its examples is fictional demonstration material and must never be imported into the campaign.",
    ...style.principles.map((principle) => `- ${principle}`),
    ...style.examples.flatMap((example, index) => [`Example ${index + 1} input: ${example.input}`, `Example ${index + 1} output: ${example.output}`]),
  ].join("\n");
}

export function listNarrationStyles() {
  return Object.values(STYLES).map((style) => ({ ...style, principles:[...style.principles], examples:style.examples.map((example) => ({ ...example })) }));
}
