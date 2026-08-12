const clone = (value) => JSON.parse(JSON.stringify(value));

const normalise = (value) => String(value || "")
  .toLowerCase()
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const readPath = (state, path) => String(path || "")
  .split(".")
  .filter(Boolean)
  .reduce((value, key) => value?.[key], state);

export function requirementsMet(state, requirements = []) {
  return requirements.every((requirement) => {
    const value = readPath(state, requirement.path);
    if (Object.hasOwn(requirement, "equals")) return value === requirement.equals;
    if (Object.hasOwn(requirement, "minimum")) return Number(value) >= Number(requirement.minimum);
    if (Object.hasOwn(requirement, "includes")) return Array.isArray(value) && value.includes(requirement.includes);
    return Boolean(value);
  });
}

export function createInitialWorldState(definition, persisted = {}) {
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
  const currentLocation = persisted.currentLocation
    || persisted.currentLocationKey
    || definition.startLocation;
  return {
    schemaVersion: 1,
    adventureId: definition.id,
    currentLocation,
    visited: [...new Set([definition.startLocation, currentLocation, ...(persisted.visited || [])].filter(Boolean))],
    flags: { ...(persisted.flags || {}) },
    objects: { ...initialObjects, ...(persisted.objects || {}) },
    containers: { ...initialContainers, ...(persisted.containers || {}) },
    itemOwners: { ...(persisted.itemOwners || {}) },
  };
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
  if (/\b(check|search|look|inspect|examine|scan|sweep|investigate|study|read)\b/.test(words)) return "observe";
  if (/\buse\b.*\bkey\b.*\b(door|lock|hatch|gate)\b/.test(words)) return "object";
  if (/\b(unlock|lock|open|close|shut)\b/.test(words)) return "object";
  if (/\b(pick up|pickup|take|collect|grab)\b/.test(words)) return "pickup";
  if (/\b(go|enter|cross|follow|descend|ascend|leave|return|walk|run|travel|proceed|advance|step)\b/.test(words)) return "move";
  return "other";
}

function matches(words, ...candidates) {
  return candidates.some((candidate) => {
    const term = normalise(candidate);
    return term && words.includes(term);
  });
}

function inventoryNames(inventory = []) {
  return inventory.flatMap((entry) => [entry.name, entry.itemName, entry.label]).filter(Boolean).map(normalise);
}

function objectForAction(definition, state, words) {
  const location = definition.locations[state.currentLocation];
  const exits = location?.exits || [];
  const candidates = exits.filter((exit) => exit.object && matches(words, exit.object, exit.via));
  if (candidates.length === 1) return { id: candidates[0].object, exit: candidates[0] };
  return null;
}

function exitForMovement(definition, state, words) {
  const location = definition.locations[state.currentLocation];
  const exits = location?.exits || [];
  const matchesTarget = exits.filter((exit) => {
    const destination = definition.locations[exit.to];
    return matches(words, exit.to, destination?.name, exit.via);
  });
  if (matchesTarget.length === 1) return matchesTarget[0];
  if (exits.length === 1 && /\b(through|forward|onward|ahead|deeper|inside|outside|down|up)\b/.test(words)) return exits[0];
  return null;
}

function hasRequiredKey(definition, state, object, inventory) {
  if (!object?.key) return true;
  if (state.itemOwners[object.key]) return true;
  const item = definition.items?.[object.key];
  const names = inventoryNames(inventory);
  return names.some((name) => matches(name, object.key, item?.name));
}

export function resolveWorldAction({ definition, state: suppliedState, action, actorId, inventory = [], mode = "act" }) {
  const state = createInitialWorldState(definition, suppliedState);
  const next = clone(state);
  const words = normalise(action);
  const intent = classifyWorldAction(action, mode);
  const result = (values = {}) => ({ handled: true, accepted: true, state: next, intent, events: [], ...values });
  if (!words || intent === "speech") return result({ handled: false });

  if (intent === "observe") {
    return result({ check: abilityCheckForAction(action), message: "Observation does not move the party or operate what is being examined." });
  }

  if (intent === "pickup") {
    if (/\bcotton\b/.test(words)) return result({ accepted: false, reason: "companion-not-item", message: "Cotton is a companion, not an inventory item." });
    const itemEntry = Object.entries(definition.items || {}).find(([id, item]) => matches(words, id, item.name));
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
    return result({ message: `${item.name} is added to the inventory.`, events: [{ type: "item-acquired", itemId, actorId }] });
  }

  if (intent === "object") {
    const containerEntry = Object.entries(definition.containers || {}).find(([id, container]) => container.location === next.currentLocation && matches(words, id, container.name));
    if (containerEntry && /\bopen\b/.test(words)) {
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
      });
    }
    const target = objectForAction(definition, next, words);
    if (!target) return result({ handled: false });
    const objectDefinition = definition.objects?.[target.id] || {};
    const objectState = next.objects[target.id] ||= clone(objectDefinition.initial || {});
    if (/\buse\b.*\bkey\b/.test(words)) {
      if (!hasRequiredKey(definition, next, objectDefinition, inventory)) {
        return result({ accepted: false, reason: "missing-key", message: `The matching key is required to unlock ${target.exit.via}.` });
      }
      objectState.locked = false;
      objectState.open = true;
      return result({
        message: `${target.exit.via} unlocks and opens.`,
        events: [{ type: "object-opened", objectId: target.id }],
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
    const exit = exitForMovement(definition, next, words);
    if (!exit) {
      const namedOtherLocation = Object.entries(definition.locations).find(([id, location]) => id !== next.currentLocation && matches(words, id, location.name));
      if (namedOtherLocation) return result({ accepted: false, reason: "not-adjacent", message: `That location is not directly reachable from ${definition.locations[next.currentLocation].name}.` });
      return result({ handled: false });
    }
    if (!requirementsMet(next, exit.requires || [])) {
      return result({ accepted: false, reason: "requirements", message: `${exit.via} cannot be crossed yet.` });
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
    next.currentLocation = exit.to;
    if (!next.visited.includes(exit.to)) next.visited.push(exit.to);
    return result({ message: `The party moves to ${definition.locations[exit.to].name}.`, events: [{ type: "location-entered", locationId: exit.to }] });
  }

  return result({ handled: false, check: abilityCheckForAction(action) });
}
