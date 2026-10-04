import { createCanonicalState, availableInteractions } from "./interaction-engine.mjs";
import { requirementsMet } from "./world-state.mjs";

// Completion awards progress, not a world lock. Only authored, currently
// eligible closing scenes can offer transitions to another adventure.
export function aftermathView(definition, world, {status, adventures = [], players = []} = {}) {
  if (status !== "complete" || !definition?.aftermath?.playable) return null;
  const state = createCanonicalState(definition,world);
  const scene = (definition.aftermath.scenes || []).find((entry)=>entry.location === state.currentLocation && requirementsMet(state,entry.requires || []));
  if (!scene) return null;
  const available = availableInteractions(definition,state,"act");
  const actions = (scene.actions || []).map((entry)=>({...entry,available:available.some((interaction)=>interaction.id === entry.interactionId)}));
  const matches = adventures.filter((entry)=>scene.nextAdventure && (entry.id === scene.nextAdventure || entry.id.endsWith(`-${scene.nextAdventure}`)));
  const next = matches.length === 1 ? matches[0] : null;
  return {
    title:scene.title,summary:scene.summary,actions,
    nextAdventure:next ? {id:next.id,title:next.title,minLevel:next.minLevel,available:players.length > 0 && players.every((player)=>player.level >= next.minLevel && player.level <= next.maxLevel)} : null,
  };
}
