const REQUIRED_ADVENTURE_FIELDS = ["id", "title", "startLocation", "locations"];

function pushUnique(target, message) {
  if (!target.includes(message)) target.push(message);
}

function validateRequirements(requirements, path, errors) {
  if (requirements == null) return;
  if (!Array.isArray(requirements)) {
    errors.push(`${path} must be an array.`);
    return;
  }

  for (const [index, requirement] of requirements.entries()) {
    if (!requirement || typeof requirement !== "object") {
      errors.push(`${path}[${index}] must be an object.`);
      continue;
    }
    if (!requirement.path || typeof requirement.path !== "string") {
      errors.push(`${path}[${index}].path must be a state path.`);
    }
    if (!("equals" in requirement) && !("minimum" in requirement) && !("includes" in requirement)) {
      errors.push(`${path}[${index}] needs equals, minimum, or includes.`);
    }
  }
}

function reachableLocations(adventure) {
  const visited = new Set();
  const queue = [adventure.startLocation];

  while (queue.length) {
    const locationId = queue.shift();
    if (visited.has(locationId) || !adventure.locations[locationId]) continue;
    visited.add(locationId);
    for (const exit of adventure.locations[locationId].exits || []) {
      if (!visited.has(exit.to)) queue.push(exit.to);
    }
  }

  return visited;
}

export function validateAdventure(adventure) {
  const errors = [];
  const warnings = [];

  if (!adventure || typeof adventure !== "object") {
    return { valid: false, errors: ["Adventure must be an object."], warnings };
  }

  for (const field of REQUIRED_ADVENTURE_FIELDS) {
    if (!adventure[field]) errors.push(`Missing required adventure field: ${field}.`);
  }
  if (adventure.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1.");
  }
  if (!adventure.locations || typeof adventure.locations !== "object" || Array.isArray(adventure.locations)) {
    errors.push("locations must be an object keyed by stable location IDs.");
    return { valid: errors.length === 0, errors, warnings };
  }
  if (!adventure.locations[adventure.startLocation]) {
    errors.push(`startLocation '${adventure.startLocation}' does not exist.`);
  }

  for (const [locationId, location] of Object.entries(adventure.locations)) {
    if (!location.name) errors.push(`locations.${locationId}.name is required.`);
    if (!Number.isFinite(location.stage) || location.stage < 0) {
      errors.push(`locations.${locationId}.stage must be a non-negative number.`);
    }
    if (!location.map || !Number.isFinite(location.map.x) || !Number.isFinite(location.map.y)) {
      errors.push(`locations.${locationId}.map requires numeric x and y coordinates.`);
    }
    if (!Array.isArray(location.features)) {
      errors.push(`locations.${locationId}.features must be an array.`);
    } else {
      const featureIds = new Set();
      for (const feature of location.features) {
        if (!feature?.id || !feature?.label) {
          errors.push(`Every feature in locations.${locationId} needs id and label.`);
          continue;
        }
        if (featureIds.has(feature.id)) errors.push(`Duplicate feature '${feature.id}' in ${locationId}.`);
        featureIds.add(feature.id);
      }
    }
    if (!Array.isArray(location.exits)) {
      errors.push(`locations.${locationId}.exits must be an array.`);
      continue;
    }
    for (const [index, exit] of location.exits.entries()) {
      if (!exit?.to || !adventure.locations[exit.to]) {
        errors.push(`locations.${locationId}.exits[${index}] points to unknown location '${exit?.to || "(missing)"}'.`);
      }
      if (!exit?.via) errors.push(`locations.${locationId}.exits[${index}].via is required.`);
      validateRequirements(exit?.requires, `locations.${locationId}.exits[${index}].requires`, errors);
    }
  }

  for (const [locationId, location] of Object.entries(adventure.locations)) {
    for (const exit of location.exits || []) {
      if (!exit.to || exit.oneWay || !adventure.locations[exit.to]) continue;
      const returnExit = (adventure.locations[exit.to].exits || []).some((candidate) => candidate.to === locationId);
      if (!returnExit) {
        warnings.push(`Exit ${locationId} -> ${exit.to} has no return exit; mark it oneWay if intentional.`);
      }
    }
  }

  for (const collectionName of ["objects", "containers", "items"]) {
    const collection = adventure[collectionName] || {};
    if (typeof collection !== "object" || Array.isArray(collection)) {
      errors.push(`${collectionName} must be an object keyed by stable IDs.`);
      continue;
    }
    for (const [id, entry] of Object.entries(collection)) {
      if (!entry.name) errors.push(`${collectionName}.${id}.name is required.`);
      const locationIds = entry.locations || (entry.location ? [entry.location] : []);
      for (const locationId of locationIds) {
        if (!adventure.locations[locationId]) {
          errors.push(`${collectionName}.${id} references unknown location '${locationId}'.`);
        }
      }
      validateRequirements(entry.requires, `${collectionName}.${id}.requires`, errors);
    }
  }

  for (const [containerId, container] of Object.entries(adventure.containers || {})) {
    for (const itemId of container.items || []) {
      if (!adventure.items?.[itemId]) {
        errors.push(`containers.${containerId} contains unknown item '${itemId}'.`);
      }
    }
  }

  for (const [sceneId, scene] of Object.entries(adventure.scenes || {})) {
    if (!scene.location || !adventure.locations[scene.location]) {
      errors.push(`scenes.${sceneId} references an unknown location.`);
    }
    validateRequirements(scene.requires, `scenes.${sceneId}.requires`, errors);
    if (!scene.summary) warnings.push(`scenes.${sceneId} has no author-facing summary.`);
  }

  const reachable = reachableLocations(adventure);
  const unreachable = [];
  for (const locationId of Object.keys(adventure.locations)) {
    if (!reachable.has(locationId)) {
      unreachable.push(locationId);
      pushUnique(warnings, `Location '${locationId}' is unreachable from the start.`);
    }
  }

  const stages = Object.values(adventure.locations).map((location) => location.stage).sort((a, b) => a - b);
  if (stages.length && stages[0] !== 0) warnings.push("The earliest location stage is not 0.");
  for (let index = 1; index < stages.length; index += 1) {
    if (stages[index] - stages[index - 1] > 2) {
      pushUnique(warnings, `Location stages jump from ${stages[index - 1]} to ${stages[index]}.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, unreachable };
}

export function assertValidAdventure(adventure) {
  const result = validateAdventure(adventure);
  if (!result.valid) {
    throw new Error(`Invalid adventure '${adventure?.id || "unknown"}':\n- ${result.errors.join("\n- ")}`);
  }
  return adventure;
}

export function listAdventureLocations(adventure) {
  return Object.entries(adventure.locations).map(([key, location]) => ({ key, ...location }));
}
