import { availableInteractions, createCanonicalState } from "./interaction-engine.mjs";
import { requirementsMet, visibleLocationFeatures } from "./world-state.mjs";

const normalise = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const title = (value) => String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());

function visibleExit(definition, state, sourceId, route) {
  const objectState = route.object ? state.objects?.[route.object] : null;
  if (objectState?.discovered === false) return null;
  const destination = definition.locations?.[route.to];
  if (!destination) return null;
  return {
    id:`exit:${sourceId}:${route.to}`,
    kind:"exit",
    sourceId,
    destinationId:route.to,
    destination:destination.name,
    via:route.via,
    direction:route.direction || null,
    objectId:route.object || null,
    available:requirementsMet(state, route.requires || []) && !objectState?.locked,
  };
}

function interactionEntry(interaction, mode) {
  const firstVerb = normalise(interaction.verbs?.[0]);
  const preferredMode = (interaction.modes || []).includes("speak") && /^(ask|tell|say|speak|request)$/.test(firstVerb)
    ? "speak"
    : (interaction.modes || []).includes("act") ? "act" : mode;
  return {
    id:interaction.id,
    kind:"interaction",
    mode:preferredMode,
    modes:[...(interaction.modes || [mode])],
    verbs:[...(interaction.verbs || [])],
    targets:[...(interaction.targets || [])],
    target:String(interaction.targets?.[0] || "").trim(),
    priority:Number(interaction.priority || 0),
  };
}

function interactionGuidance(entry, locationName) {
  const verb = entry.verbs[0] || (entry.mode === "speak" ? "ask" : "examine");
  const target = entry.target;
  if (!target) return null;
  const connector = normalise(verb) === "ask" && !/\babout\b/i.test(target) ? " about" : "";
  const text = `${verb}${connector} ${target}`.replace(/\s+/g, " ").trim();
  return {
    sourceId:`interaction:${entry.id}`,
    label:title(text).slice(0, 48),
    text:`${text[0].toUpperCase()}${text.slice(1)}.`,
    mode:entry.mode,
    reason:`This is an established option in ${locationName}.`,
  };
}

export function guidanceFromCommandSurface(surface, limit = 3) {
  const suggestions = [];
  const seen = new Set();
  const add = (suggestion, identity) => {
    if (!suggestion || seen.has(identity) || suggestions.length >= limit) return;
    seen.add(identity);
    suggestions.push(suggestion);
  };

  if (surface.pendingOffer) {
    add({
      sourceId:`offer:${surface.pendingOffer.interactionId}`,
      label:`Follow ${surface.pendingOffer.npcName || "The Offer"}`,
      text:`Follow ${surface.pendingOffer.npcName || "the offered route"}.`,
      mode:"act",
      reason:"This accepts the currently recorded offer.",
    }, `offer:${surface.pendingOffer.interactionId}`);
  }

  for (const interaction of surface.interactions) {
    add(interactionGuidance(interaction, surface.location.name), `target:${normalise(interaction.target)}`);
  }
  for (const route of surface.exits.filter((entry) => entry.available)) {
    add({
      sourceId:route.id,
      label:`Go to ${route.destination}`,
      text:`Go to ${route.destination} through the ${route.via}.`,
      mode:"act",
      reason:`This is a currently available exit from ${surface.location.name}.`,
    }, `target:${normalise(route.destination)}`);
  }
  for (const feature of surface.visibleFeatures) {
    add({
      sourceId:`feature:${feature.id}`,
      label:`Examine ${feature.label}`,
      text:`Examine the ${feature.label}.`,
      mode:"act",
      reason:"This feature is currently visible.",
    }, `target:${normalise(feature.label)}`);
  }
  for (const npc of surface.presentNpcs) {
    add({
      sourceId:`npc:${npc.id}`,
      label:`Speak with ${npc.name}`,
      text:`Speak with ${npc.name}.`,
      mode:"speak",
      reason:`${npc.name} is currently present.`,
    }, `target:${normalise(npc.name)}`);
  }
  return suggestions;
}

export function buildSceneCommandSurface(definition, suppliedState = {}, { inventory = [], pendingOffer = null } = {}) {
  const state = createCanonicalState(definition, suppliedState);
  const location = definition.locations?.[state.currentLocation];
  if (!location) throw new Error(`Cannot build a command surface for unknown location '${state.currentLocation}'.`);
  const visibleFeatures = visibleLocationFeatures(definition, state).map((feature) => ({
    id:feature.id,
    label:feature.label,
    kind:feature.kind || "scenery",
  }));
  const exits = (location.exits || []).map((route) => visibleExit(definition, state, state.currentLocation, route)).filter(Boolean);
  const presentNpcs = Object.entries(definition.story?.npcs || {})
    .filter(([, npc]) => (npc.locations || []).includes(state.currentLocation))
    .map(([id, npc]) => ({ id, name:npc.name, role:npc.role || "" }));
  const carriedItems = (Array.isArray(inventory) ? inventory : []).map((item) => ({
    id:String(item.id || item.name || ""), name:String(item.name || ""), quantity:Number(item.quantity || 1), status:String(item.status || "carried"),
  })).filter((item) => item.id && item.name);
  const interactions = [
    ...availableInteractions(definition, state, "act").map((entry) => interactionEntry(entry, "act")),
    ...availableInteractions(definition, state, "speak").map((entry) => interactionEntry(entry, "speak")),
  ].filter((entry, index, entries) => entries.findIndex((candidate) => candidate.id === entry.id) === index)
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  const offerInteraction = pendingOffer?.interactionId
    ? interactions.find((entry) => entry.id === pendingOffer.interactionId)
    : null;
  const npc = pendingOffer?.npcId ? presentNpcs.find((entry) => entry.id === pendingOffer.npcId) : null;
  const pending = offerInteraction && Number(pendingOffer.worldRevision || 0) === Number(state.revision || 0)
    ? { interactionId:offerInteraction.id, npcId:npc?.id || null, npcName:npc?.name || null }
    : null;
  const surface = {
    revision:Number(state.revision || 0),
    location:{ id:state.currentLocation, name:location.name },
    visibleFeatures,
    exits,
    presentNpcs,
    carriedItems,
    interactions,
    pendingOffer:pending,
  };
  return { ...surface, guidance:guidanceFromCommandSurface(surface) };
}
