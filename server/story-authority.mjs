function currentAct(story, stage) {
  const numericStage = Number(stage || 0);
  return (story?.acts || []).find((act) => numericStage >= act.stages[0] && numericStage <= act.stages[1]) || null;
}

function npcIsRelevant(npc, locationId, worldState) {
  return npcLocations(npc,worldState).includes(locationId);
}

function clueIsRelevant(clue, locationId) {
  return (clue.sources || []).some((source) => source.location === locationId);
}

export function buildStoryAuthority(definition, { worldState = {}, dmState = {} } = {}) {
  const story = definition?.story;
  if (!story) return null;
  const currentLocationId = worldState.currentLocation || dmState.currentLocationKey || definition.startLocation;
  const currentLocation = definition.locations?.[currentLocationId];
  const stage = Number(dmState?.[definition.stateKey || "clueStage"] || 0);

  return {
    contract: "This is the canonical authored story. Fixed truths may guide resolution but remain secret until an authored clue source reveals them. Current-location sources are possibilities, not automatic discoveries. Never relocate a clue, grant an NPC extra knowledge, or invent a competing explanation.",
    identity: {
      id: definition.id,
      title: definition.title,
      premise: definition.premise,
      dramaticQuestion: story.dramaticQuestion,
      playerPromise: story.playerPromise,
    },
    currentScene: {
      stage,
      act: currentAct(story, stage),
      locationId: currentLocationId,
      location: currentLocation ? projectScene(definition, {...worldState,currentLocation:currentLocationId}) : null,
    },
    fixedTruths: (story.fixedTruths || []).filter((truth) => requirementsMet(worldState, truth.requires || [])),
    relevantNpcs: Object.fromEntries(Object.entries(story.npcs || {}).filter(([, npc]) => npcIsRelevant(npc, currentLocationId, worldState)).map(([id,npc]) => [id,projectNpc(npc,worldState)])),
    relevantClues: Object.fromEntries(Object.entries(story.clues || {}).filter(([, clue]) => clueIsRelevant(clue, currentLocationId))),
    consequences: story.consequences,
    improvisation: story.improvisation,
    principles: definition.principles,
  };
}
import { requirementsMet, npcLocations } from "./world-state.mjs";
import { projectScene, projectNpc } from "./scene-projection.mjs";
