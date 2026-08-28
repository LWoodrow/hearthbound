const clone = (value) => JSON.parse(JSON.stringify(value));

const normalise = (value) => String(value || "")
  .toLowerCase()
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\bpubs?\b/g, "tavern")
  .trim();

const readPath = (state, path) => String(path || "")
  .split(".")
  .filter(Boolean)
  .reduce((value, key) => value?.[key], state);

function mergeStateEntries(initial, persisted) {
  const initialEntries = initial && typeof initial === "object" ? initial : {};
  const persistedEntries = persisted && typeof persisted === "object" ? persisted : {};
  return Object.fromEntries(
    [...new Set([...Object.keys(initialEntries), ...Object.keys(persistedEntries)])]
      .map((id) => [
        id,
        {
          ...(initialEntries[id] && typeof initialEntries[id] === "object" ? initialEntries[id] : {}),
          ...(persistedEntries[id] && typeof persistedEntries[id] === "object" ? persistedEntries[id] : {}),
        },
      ]),
  );
}

function routeFromStart(definition, destination) {
  const start = definition.startLocation;
  if (!definition.locations?.[start] || !definition.locations?.[destination]) return [];
  const queue = [[start]];
  const visited = new Set();
  while (queue.length) {
    const path = queue.shift();
    const locationId = path.at(-1);
    if (visited.has(locationId)) continue;
    if (locationId === destination) return path;
    visited.add(locationId);
    for (const route of definition.locations[locationId]?.exits || []) {
      if (!visited.has(route.to) && definition.locations[route.to]) queue.push([...path, route.to]);
    }
  }
  return [start, destination];
}

export function requirementsMet(state, requirements = []) {
  return requirements.every((requirement) => {
    const value = readPath(state, requirement.path);
    if (Object.hasOwn(requirement, "equals")) return value === requirement.equals;
    if (Object.hasOwn(requirement, "minimum")) return Number(value) >= Number(requirement.minimum);
    if (Object.hasOwn(requirement, "includes")) return Array.isArray(value) && value.includes(requirement.includes);
    if (requirement.truthy === true) return Boolean(value);
    return Boolean(value);
  });
}

export function createInitialWorldState(definition, persisted = {}) {
  const saved = persisted && typeof persisted === "object" ? persisted : {};
  const initialObjects = Object.fromEntries(
    Object.entries(definition.objects || {}).map(([id, object]) => [id, clone(object.initial || {})]),
  );
  const initialContainers = Object.fromEntries(
    Object.entries(definition.containers || {}).map(([id, container]) => [id, {
      open: false,
      discovered: container.hidden ? false : true,
      ...(container.initial || {}),
    }]),
  );
  const requestedLocation = saved.currentLocation
    || saved.currentLocationKey
    || definition.startLocation;
  const currentLocation = definition.locations?.[requestedLocation]
    ? requestedLocation
    : definition.startLocation;
  const restoredRoute = routeFromStart(definition, currentLocation);
  const persistedVisits = Array.isArray(saved.visited)
    ? saved.visited.filter((locationId) => definition.locations?.[locationId])
    : [];
  const savedPrevious = saved.previousLocation;
  const savedPreviousIsAdjacent = Boolean(
    definition.locations?.[savedPrevious]
    && (
      (definition.locations[currentLocation]?.exits || []).some((route) => route.to === savedPrevious)
      || (definition.locations[savedPrevious]?.exits || []).some((route) => route.to === currentLocation)
    ),
  );
  const previousLocation = savedPreviousIsAdjacent
    ? savedPrevious
    : restoredRoute.at(-2) || null;
  return {
    schemaVersion: Math.max(1, Number(saved.schemaVersion || 1)),
    revision: Math.max(0, Number(saved.revision || 0)),
    adventureId: definition.id,
    currentLocation,
    previousLocation,
    visited: [...new Set([...restoredRoute, ...persistedVisits].filter(Boolean))],
    flags: { ...(definition.initialFlags || {}), ...(saved.flags || {}) },
    objects: mergeStateEntries(initialObjects, saved.objects),
    containers: mergeStateEntries(initialContainers, saved.containers),
    itemOwners: { ...(saved.itemOwners || {}) },
    // Canonical story-state fields are preserved here because the lower-level
    // navigation resolver also normalises state. Dropping them during a move
    // would make an accepted interaction disappear on the following turn.
    discoveries: [...new Set(saved.discoveries || [])],
    completedInteractions: [...new Set(saved.completedInteractions || [])],
    resources: { ...(saved.resources || {}) },
    clocks: { ...(saved.clocks || {}) },
    knowledge: { ...(saved.knowledge || {}) },
    outcomes: Array.isArray(saved.outcomes) ? saved.outcomes.slice(-100) : [],
  };
}

function unmetRequirements(state, requirements = []) {
  return requirements.filter((requirement) => !requirementsMet(state, [requirement])).map((requirement) => ({
    path:String(requirement.path || ""),
    predicate:Object.hasOwn(requirement, "equals") ? "equals" : Object.hasOwn(requirement, "minimum") ? "minimum" : Object.hasOwn(requirement, "includes") ? "includes" : "truthy",
  }));
}

function candidateAffordances(definition, state, intent, inventory = []) {
  const location = definition.locations?.[state.currentLocation];
  const candidates = [];
  if (intent === "move") for (const exit of location?.exits || []) {
    const objectState = exit.object ? state.objects?.[exit.object] : null;
    const failed = unmetRequirements(state, exit.requires || []);
    if (objectState?.discovered === false) failed.push({ path:`objects.${exit.object}.discovered`, predicate:"visible" });
    if (objectState?.locked) failed.push({ path:`objects.${exit.object}.locked`, predicate:"unlocked" });
    candidates.push({ id:`move:${state.currentLocation}:${exit.to}`, kind:"movement", target:exit.to, failedPrerequisites:failed });
  }
  if (intent === "object") {
    for (const [id, container] of Object.entries(definition.containers || {})) if (container.location === state.currentLocation) {
      candidates.push({ id:`container:${id}`, kind:"container", target:id, failedPrerequisites:container.key && !hasRequiredKey(definition, state, container, inventory) ? [{ path:`items.${container.key}`, predicate:"possessed" }] : [] });
    }
    for (const exit of location?.exits || []) if (exit.object) {
      const objectState = state.objects?.[exit.object] || {};
      candidates.push({ id:`object:${exit.object}`, kind:"object", target:exit.object, failedPrerequisites:objectState.discovered === false ? [{ path:`objects.${exit.object}.discovered`, predicate:"visible" }] : [] });
    }
  }
  if (intent === "pickup") for (const [id, item] of Object.entries(definition.items || {})) {
    const container = item.container ? definition.containers?.[item.container] : null;
    const local = item.location === state.currentLocation || container?.location === state.currentLocation;
    if (local) candidates.push({ id:`pickup:${id}`, kind:"pickup", target:id, failedPrerequisites:item.container && !state.containers?.[item.container]?.open ? [{ path:`containers.${item.container}.open`, predicate:"equals" }] : [] });
  }
  if (intent === "observe") candidates.push({ id:`observe:${state.currentLocation}`, kind:"observation", target:state.currentLocation, failedPrerequisites:[] });
  return candidates;
}

export function abilityCheckForAction(action) {
  const words = normalise(action);
  const searches = /\b(check|search|look|inspect|examine|scan|sweep|investigate)\b/.test(words);
  if (searches && /\b(trap|traps|hazard|hazards|tripwire|pressure plate|ambush|danger)\b/.test(words)) {
    return { ability: "Wisdom", skill: "Perception", dc: 12, reason: "Search the visible area for traps or immediate hazards." };
  }
  if (searches && /\b(mechanism|mechanisms|construction|evidence|seam|rune|runes|symbol|symbols|carving|carvings|lock)\b/.test(words)) {
    return { ability: "Intelligence", skill: "Investigation", dc: 12, reason: "Study the visible construction and evidence without operating it." };
  }
  if (/\b(force|break|bash|shove|push|lift|move|clear|bend|pry)\b/.test(words)
    && /\b(door|gate|barrier|stone|stones|rubble|debris|portcullis|obstacle|chain)\b/.test(words)) {
    const heavy = /\b(stone|rubble|portcullis|reinforced|heavy)\b/.test(words);
    return { ability: "Strength", skill: "Athletics", dc: heavy ? 14 : 12, reason: "Overcome a demanding physical obstacle." };
  }
  if (/\b(climb|swim|jump|leap|grapple)\b/.test(words)) {
    return { ability: "Strength", skill: "Athletics", dc: 12, reason: "Attempt a risky physical manoeuvre." };
  }
  return null;
}

export function classifyWorldAction(action, mode = "act") {
  const words = normalise(action);
  if (mode === "speak") return "speech";
  if (/\b(is there|are there|what|which)\b/.test(words)) return "observe";
  if (/\b(check|search|look|inspect|examine|scan|sweep|investigate|study|read)\b/.test(words)) return "observe";
  if (/\buse\b.*\bkey\b.*\b(door|lock|hatch|gate)\b/.test(words)) return "object";
  // Treat "open the door and walk in" as the requested crossing. The
  // movement resolver safely opens an unlocked route object while entering.
  if (/\b(open|unfasten|push)\b/.test(words)
    && /\b(go|move|enter|cross|walk|run|travel|proceed|step|sneak|slip|creep|crawl|head)\b/.test(words)) return "move";
  if (/\b(unlock|lock|open|close|shut|unfasten)\b|\blift (?:the )?lid\b/.test(words)) return "object";
  if (/\b(pick up|pickup|take|collect|grab)\b/.test(words)) return "pickup";
  if (/\b(go|move|enter|cross|follow|descend|ascend|leave|return|walk|run|travel|proceed|advance|continue|step|sneak|slip|creep|crawl|head)\b|\bmake (?:my|our|your|their) way\b/.test(words)) return "move";
  return "other";
}

function matches(words, ...candidates) {
  return candidates.some((candidate) => {
    const term = normalise(candidate);
    return term && words.includes(term);
  });
}

function singularToken(token) {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
  return token;
}

function mentionsNamedThing(words, ...candidates) {
  if (matches(words, ...candidates)) return true;
  const actionTokens = new Set(normalise(words).split(" ").filter(Boolean).flatMap((token) => [token, singularToken(token)]));
  const generic = new Set(["area", "door", "item", "place", "room", "thing"]);
  return candidates.some((candidate) => normalise(candidate)
    .split(" ")
    .some((token) => token.length >= 4 && !generic.has(token) && actionTokens.has(singularToken(token))));
}

function namedThingScore(words, ...candidates) {
  if (matches(words, ...candidates)) return 100;
  const actionTokens = new Set(normalise(words).split(" ").filter(Boolean).flatMap((token) => [token, singularToken(token)]));
  const generic = new Set(["area", "door", "item", "place", "room", "thing"]);
  return Math.max(0, ...candidates.map((candidate) => normalise(candidate)
    .split(" ")
    .filter((token) => token.length >= 4 && !generic.has(token) && actionTokens.has(singularToken(token))).length));
}

function inventoryNames(inventory = []) {
  return inventory.flatMap((entry) => [entry.name, entry.itemName, entry.label]).filter(Boolean).map(normalise);
}

function objectForAction(definition, state, words) {
  const location = definition.locations[state.currentLocation];
  const exits = location?.exits || [];
  const candidates = exits.filter((exit) => exit.object && matches(words, exit.object, exit.via));
  if (candidates.length === 1) return { id: candidates[0].object, exit: candidates[0] };
  const genericRouteObject = /\b(?:door|hatch|gate|entrance|exit)\b/.test(words);
  if (genericRouteObject) {
    const visible = exits.filter((exit) => exit.object && state.objects?.[exit.object]?.discovered !== false);
    const stateChanging = visible.filter((exit) => {
      const object = state.objects?.[exit.object] || {};
      if (/\bopen\b/.test(words)) return object.open !== true;
      if (/\b(?:close|shut)\b/.test(words)) return object.open === true;
      return false;
    });
    if (stateChanging.length === 1) return { id:stateChanging[0].object, exit:stateChanging[0] };
  }
  return null;
}

function requestedVerticalDirection(words) {
  if (/\b(?:down|descend|downstairs|below)\b/.test(words)) return "down";
  if (/\b(?:up|ascend|upstairs|above)\b/.test(words)) return "up";
  return "";
}

function exitForMovement(definition, state, words) {
  const location = definition.locations[state.currentLocation];
  const authoredExits = location?.exits || [];
  const requestedDirection = requestedVerticalDirection(words);
  const directionalExits = authoredExits.filter((exit) => exit.direction);
  // If this location has authored vertical routes, a directional command must
  // agree with one of them. Never turn "go down" into movement up the only
  // stairs merely because both phrases mention stairs.
  const exits = requestedDirection && directionalExits.length
    ? authoredExits.filter((exit) => exit.direction === requestedDirection)
    : authoredExits;
  const matchesTarget = exits.filter((exit) => {
    const destination = definition.locations[exit.to];
    return mentionsNamedThing(words, exit.to, destination?.name, ...(destination?.aliases || []), exit.via);
  });
  if (matchesTarget.length === 1) return matchesTarget[0];

  const movesBackward = /\b(back|return|retreat)\b/.test(words);
  if (movesBackward) {
    const previousExit = exits.find((exit) => exit.to === state.previousLocation);
    if (previousExit) return previousExit;
    const visitedExits = exits.filter((exit) => state.visited.includes(exit.to));
    if (visitedExits.length === 1) return visitedExits[0];
  }

  const movesForward = /\b(forward|onward|ahead|deeper|inside|down)\b/.test(words);
  if (movesForward) {
    const continuingExits = exits.filter((exit) => exit.to !== state.previousLocation);
    if (continuingExits.length === 1) return continuingExits[0];
    const unvisitedExits = continuingExits.filter((exit) => !state.visited.includes(exit.to));
    if (unvisitedExits.length === 1) return unvisitedExits[0];
  }

  if (exits.length === 1 && /\b(through|outside|inside|in|up)\b/.test(words)) return exits[0];
  return null;
}

function hasRequiredKey(definition, state, object, inventory) {
  if (!object?.key) return true;
  if (state.itemOwners[object.key]) return true;
  const item = definition.items?.[object.key];
  const names = inventoryNames(inventory);
  return names.some((name) => matches(name, object.key, item?.name));
}

function featurePresentation(feature, state) {
  const presentation = (feature.presentations || []).find((candidate) =>
    requirementsMet(state, candidate.requires || [])
    && !(candidate.forbids?.length && requirementsMet(state, candidate.forbids)));
  if (!presentation) return feature;
  const { requires, forbids, ...visible } = presentation;
  return { ...feature, ...visible };
}

export function visibleLocationFeatures(definition, state, locationId = state.currentLocation) {
  const location = definition.locations[locationId];
  return (location?.features || []).filter((feature) => {
    if (state.objects?.[feature.id]?.discovered === false) return false;
    if (state.containers?.[feature.id]?.discovered === false) return false;
    if (definition.items?.[feature.id] && state.itemOwners?.[feature.id]) return false;
    return true;
  }).map((feature) => featurePresentation(feature, state));
}

function observationResult(definition, state, words) {
  const location = definition.locations[state.currentLocation];
  if (!location) return { handled:false };
  const visibleFeatures = visibleLocationFeatures(definition, state);
  const featureList = visibleFeatures.map((feature) => feature.label).join(", ") || "the established surroundings";
  const visibleNpc = Object.values(definition.story?.npcs || {}).find((npc) =>
    (npc.locations || []).includes(state.currentLocation)
    && mentionsNamedThing(words, npc.name));
  if (visibleNpc && /\b(wear|wearing|look|looks|appearance|hair|clothes|clothing|dressed|describe)\b/.test(words)) {
    return visibleNpc.appearance
      ? { message:visibleNpc.appearance }
      : { message:`No further visible description is authored for ${visibleNpc.name}.` };
  }
  const asksWhoIsPresent = /\b(who|anyone|anybody|people|person|persons|occupants?|staff|innkeeper|keeper)\b/.test(words)
    && /\b(who|is there|are there|present|here|inside|in (?:the )?(?:room|inn|tavern|taproom))\b/.test(words);
  if (asksWhoIsPresent) {
    const namedPeople = Object.values(definition.story?.npcs || {})
      .filter((npc) => (npc.locations || []).includes(state.currentLocation))
      .map((npc) => `${npc.name} (${npc.role})`);
    const occupants = [...namedPeople, ...(location.occupants || [])];
    return occupants.length
      ? { message:`Present in ${location.name}: ${occupants.join(", ")}.` }
      : { message:`No specific person is established as present in ${location.name}.` };
  }
  const asksWhatCanBeTaken = /\b(pick up|pickup|take|collect|grab|inventory|portable|carry)\b/.test(words)
    && /\b(anything|something|what|which|is there|are there)\b/.test(words);
  if (asksWhatCanBeTaken) {
    const portableItems = Object.entries(definition.items || {}).filter(([id, item]) => {
      if (item.portable === false || state.itemOwners[id]) return false;
      if (item.container) {
        const container = definition.containers?.[item.container];
        return container?.location === state.currentLocation && state.containers?.[item.container]?.open;
      }
      return item.location === state.currentLocation;
    }).map(([, item]) => item.name);
    return portableItems.length
      ? { message:`Portable items currently established here: ${portableItems.join(", ")}. Nothing is taken until a character explicitly takes a named item.` }
      : { message:`No unattended portable item is established in ${location.name}. The visible scenery is not automatically available as inventory.` };
  }
  const namedItem = Object.entries(definition.items || {}).find(([id, item]) => mentionsNamedThing(words, id, item.name));
  if (namedItem) {
    const [itemId, item] = namedItem;
    const container = item.container ? definition.containers?.[item.container] : null;
    const present = item.container
      ? container?.location === state.currentLocation && state.containers[item.container]?.open
      : item.location === state.currentLocation && !state.itemOwners[itemId];
    if (!present) return { message:`${item.name} is not present in ${location.name}.` };
    const feature = visibleFeatures.find((entry) => entry.id === itemId || mentionsNamedThing(normalise(item.name), entry.id, entry.label));
    if (feature?.kind === "clue") return { handled:false };
    return { message:`${item.name} is visible in ${location.name}. Examining it does not move or take it.` };
  }

  const namedFeature = visibleFeatures
    .map((feature) => ({ feature, score:namedThingScore(words, feature.id, feature.label) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.feature;
  if (namedFeature?.kind === "clue") return { handled:false };
  if (namedFeature) {
    if (namedFeature.observation && /\b(look|see|peer|watch|view|inspect|examine)\b/.test(words)) {
      return { message:namedFeature.observation };
    }
    if (namedFeature.contents?.length && /\b(on|upon|contains|holding|items|clues|what)\b/.test(words)) {
      return { message:`On the ${namedFeature.label}: ${namedFeature.contents.join(", ")}.` };
    }
    const object = state.objects?.[namedFeature.id];
    const condition = object ? object.locked ? "locked" : object.open ? "open" : "closed" : "visible";
    return { message:`The ${namedFeature.label} is ${condition} in ${location.name}.` };
  }

  const featureElsewhere = Object.values(definition.locations || {})
    .flatMap((entry) => entry.features || [])
    .map((feature) => ({ feature, score:namedThingScore(words, feature.id, feature.label) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.feature;
  if (featureElsewhere) return { message:`The ${featureElsewhere.label} is not present in ${location.name}. Visible here: ${featureList}.` };

  const genericRoomLook = /\b(look around|what is (?:in|inside) (?:the )?(?:room|area|here)|what can (?:i|we) see|describe (?:the )?(?:room|area|surroundings))\b/.test(words);
  if (genericRoomLook) return { message:`${location.description} Visible here: ${featureList}.` };

  return { message:`No feature matching that description is established in ${location.name}. Visible here: ${featureList}.` };
}

export function resolveWorldAction({ definition, state: suppliedState, action, actorId, inventory = [], mode = "act" }) {
  const state = createInitialWorldState(definition, suppliedState);
  const next = clone(state);
  const words = normalise(action);
  const intent = classifyWorldAction(action, mode);
  const candidates = candidateAffordances(definition, state, intent, inventory);
  const result = (values = {}) => ({ handled: true, accepted: true, state: next, intent, events: [], diagnostic:{ candidateAffordances:candidates, selectedAffordance:"", rejectedAlternatives:[] }, ...values });
  if (!words || intent === "speech") return result({ handled: false });

  if (intent === "observe") {
    const check = abilityCheckForAction(action);
    if (check) return result({ handled:false, check });
    return result({ ...observationResult(definition, next, words), diagnostic:{ candidateAffordances:candidates, selectedAffordance:`observe:${state.currentLocation}`, rejectedAlternatives:[] } });
  }

  if (intent === "pickup") {
    if (/\bcotton\b/.test(words)) return result({ accepted: false, reason: "companion-not-item", message: "Cotton is a companion, not an inventory item." });
    const itemEntry = Object.entries(definition.items || {}).find(([id, item]) => mentionsNamedThing(words, id, item.name, ...(item.aliases || [])));
    if (!itemEntry) return result({ handled: false });
    const [itemId, item] = itemEntry;
    const container = item.container ? definition.containers?.[item.container] : null;
    const itemIsPresent = item.container
      ? container?.location === next.currentLocation && next.containers[item.container]?.open
      : item.location === next.currentLocation;
    if (!itemIsPresent) {
      return result({ accepted: false, reason: "item-not-present", message: `${item.name} is not present in the current room.` });
    }
    if (next.itemOwners[itemId]) {
      return result({ accepted: false, reason: "already-owned", message: `${item.name} has already been taken.` });
    }
    next.itemOwners[itemId] = actorId;
    return result({ message: `${item.name} is added to the inventory.`, events: [{ type: "item-acquired", itemId, actorId }], diagnostic:{ candidateAffordances:candidates, selectedAffordance:`pickup:${itemId}`, rejectedAlternatives:candidates.filter((item) => item.id !== `pickup:${itemId}`).map((item) => item.id) } });
  }

  if (intent === "object") {
    const containerEntry = Object.entries(definition.containers || {}).find(([id, container]) => container.location === next.currentLocation && mentionsNamedThing(words, id, container.name));
    if (containerEntry && (/\b(open|unfasten)\b/.test(words) || /\blift (?:the )?lid\b/.test(words))) {
      const [containerId, container] = containerEntry;
      const current = next.containers[containerId];
      if (container.key && !hasRequiredKey(definition, next, { key: container.key }, inventory)) {
        return result({ accepted: false, reason: "locked", message: `${container.name} is locked; the matching key is required.` });
      }
      const firstOpen = !current.open;
      current.open = true;
      current.discovered = true;
      return result({
        message: firstOpen
          ? `${container.name} opens; its contents are visible but remain inside until taken.`
          : `${container.name} is already open.`,
        diagnostic:{ candidateAffordances:candidates, selectedAffordance:`container:${containerId}`, rejectedAlternatives:candidates.filter((item) => item.id !== `container:${containerId}`).map((item) => item.id) },
      });
    }
    const target = objectForAction(definition, next, words);
    if (!target) return result({ handled: false });
    const objectDefinition = definition.objects?.[target.id] || {};
    const objectState = next.objects[target.id] ||= clone(objectDefinition.initial || {});
    if (objectState.discovered === false) {
      return result({ accepted: false, reason: "hidden", message: "No revealed route matching that description is accessible here." });
    }
    if (/\buse\b.*\bkey\b/.test(words)) {
      if (!hasRequiredKey(definition, next, objectDefinition, inventory)) {
        return result({ accepted: false, reason: "missing-key", message: `The matching key is required to unlock ${target.exit.via}.` });
      }
      objectState.locked = false;
      objectState.open = true;
      return result({
        message: `${target.exit.via} unlocks and opens.`,
        events: [{ type: "object-opened", objectId: target.id }],
        diagnostic:{ candidateAffordances:candidates, selectedAffordance:`object:${target.id}`, rejectedAlternatives:candidates.filter((item) => item.id !== `object:${target.id}`).map((item) => item.id) },
      });
    }
    if (/\bunlock\b/.test(words)) {
      if (!hasRequiredKey(definition, next, objectDefinition, inventory)) {
        return result({ accepted: false, reason: "missing-key", message: `The matching key is required to unlock ${target.exit.via}.` });
      }
      objectState.locked = false;
      return result({ message: `${target.exit.via} is now unlocked.` });
    }
    if (/\bopen\b/.test(words)) {
      if (objectState.locked) {
        if (!hasRequiredKey(definition, next, objectDefinition, inventory)) {
          return result({ accepted: false, reason: "locked", message: `${target.exit.via} is locked; the matching key is required.` });
        }
        objectState.locked = false;
      }
      objectState.open = true;
      return result({ message: `${target.exit.via} is now open.` });
    }
    if (/\b(close|shut)\b/.test(words)) {
      objectState.open = false;
      return result({ message: `${target.exit.via} is now closed.` });
    }
    return result({ handled: false });
  }

  if (intent === "move") {
    const requestedDirection = requestedVerticalDirection(words);
    const directionalExits = (definition.locations[next.currentLocation]?.exits || []).filter((exit) => exit.direction);
    if (requestedDirection && directionalExits.length && !directionalExits.some((exit) => exit.direction === requestedDirection)) {
      const available = directionalExits
        .map((exit) => `${exit.direction} through ${exit.via} to ${definition.locations[exit.to]?.name || exit.to}`)
        .join(", ");
      return result({
        accepted:false,
        reason:"direction-mismatch",
        message:`No revealed route leads ${requestedDirection} from ${definition.locations[next.currentLocation].name}. The established vertical route leads ${available}; the party remains in ${definition.locations[next.currentLocation].name}.`,
        diagnostic:{ candidateAffordances:candidates, selectedAffordance:"blocked:direction-mismatch", rejectedAlternatives:candidates.map((item) => item.id) },
      });
    }
    const exit = exitForMovement(definition, next, words);
    if (!exit) {
      const namedOtherLocation = Object.entries(definition.locations).find(([id, location]) => id !== next.currentLocation && matches(words, id, location.name));
      if (namedOtherLocation) return result({ accepted: false, reason: "not-adjacent", message: `That location is not directly reachable from ${definition.locations[next.currentLocation].name}.` });
      return result({ handled: false });
    }
    if (exit.object) {
      const objectState = next.objects[exit.object] ||= {};
      if (objectState.discovered === false) {
        return result({ accepted: false, reason: "hidden", message: "No revealed route matching that description is accessible here." });
      }
    }
    if (!requirementsMet(next, exit.requires || [])) {
      return result({ accepted: false, reason: "requirements", message: `The party cannot move directly through ${exit.via} yet; the party remains in ${definition.locations[next.currentLocation].name}.` });
    }
    if (exit.object) {
      const objectDefinition = definition.objects?.[exit.object] || {};
      const objectState = next.objects[exit.object] ||= {};
      if (objectState.locked) return result({ accepted: false, reason: "locked", message: `${exit.via} is locked.` });
      if (objectState.open === false) {
        if (objectDefinition.openable === false) {
          return result({ accepted: false, reason: "closed", message: `${exit.via} cannot be crossed yet.` });
        }
        objectState.open = true;
      }
    }
    next.previousLocation = next.currentLocation;
    next.currentLocation = exit.to;
    if (!next.visited.includes(exit.to)) next.visited.push(exit.to);
    const destination = definition.locations[exit.to];
    const transition = exit.message
      || `The party passes through ${exit.via} and enters ${destination.name}. ${destination.description || ""}`.trim();
    return result({ message: transition, events: [{ type: "location-entered", locationId: exit.to }], diagnostic:{ candidateAffordances:candidates, selectedAffordance:`move:${state.currentLocation}:${exit.to}`, rejectedAlternatives:candidates.filter((item) => item.id !== `move:${state.currentLocation}:${exit.to}`).map((item) => item.id) } });
  }

  return result({ handled: false, check: abilityCheckForAction(action) });
}
