const REQUIRED_ADVENTURE_FIELDS = ["id", "title", "startLocation", "locations"];
import { validateInteractions } from "./interaction-engine.mjs";

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
    if (!("equals" in requirement) && !("minimum" in requirement) && !("includes" in requirement) && requirement.truthy !== true) {
      errors.push(`${path}[${index}] needs equals, minimum, includes, or truthy.`);
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

function validateStory(adventure, errors, warnings) {
  const story = adventure.story;
  if (!story || typeof story !== "object" || Array.isArray(story)) {
    warnings.push("No authored story package is present; narration will have only the physical adventure definition.");
    return;
  }

  if (!story.dramaticQuestion) errors.push("story.dramaticQuestion is required.");
  if (!story.playerPromise) errors.push("story.playerPromise is required.");

  const truths = Array.isArray(story.fixedTruths) ? story.fixedTruths : [];
  if (!truths.length) errors.push("story.fixedTruths must contain at least one authoritative truth.");
  const truthIds = new Set();
  for (const [index, truth] of truths.entries()) {
    if (!truth?.id || !truth?.statement) errors.push(`story.fixedTruths[${index}] needs id and statement.`);
    if (truthIds.has(truth?.id)) errors.push(`Duplicate story truth '${truth.id}'.`);
    if (truth?.id) truthIds.add(truth.id);
  }

  if (!Array.isArray(story.acts) || !story.acts.length) errors.push("story.acts must contain at least one dramatic act.");
  for (const [index, act] of (story.acts || []).entries()) {
    if (!act?.id || !act?.title || !act?.purpose) errors.push(`story.acts[${index}] needs id, title, and purpose.`);
    if (!Array.isArray(act?.stages) || act.stages.length !== 2 || act.stages.some((stage) => !Number.isFinite(stage))) {
      errors.push(`story.acts[${index}].stages must be a numeric [start, end] pair.`);
    }
  }

  const npcs = story.npcs || {};
  for (const [npcId, npc] of Object.entries(npcs)) {
    if (!npc?.name || !npc?.role) errors.push(`story.npcs.${npcId} needs name and role.`);
    for (const locationId of npc?.locations || []) {
      if (!adventure.locations[locationId]) errors.push(`story.npcs.${npcId} references unknown location '${locationId}'.`);
    }
    for (const locationId of npc.audibleFrom || []) {
      if (!adventure.locations[locationId]) errors.push(`story.npcs.${npcId}.audibleFrom references unknown location '${locationId}'.`);
      else if (!(adventure.locations[locationId].exits || []).some((exit)=>(npc.locations || []).includes(exit.to))) errors.push(`story.npcs.${npcId}.audibleFrom must be adjacent to an NPC location.`);
    }
    for (const [index,presence] of (npc.presence || []).entries()) {
      validateRequirements(presence.requires,`story.npcs.${npcId}.presence[${index}].requires`,errors);
      if (!presence.requires?.length || !presence.locations?.length || presence.locations.some((id)=>!adventure.locations[id])) errors.push(`story.npcs.${npcId}.presence[${index}] needs conditions and known locations.`);
    }
    validateRequirements(npc.callResponse?.requires,`story.npcs.${npcId}.callResponse.requires`,errors);
    for (const [index,presentation] of (npc.presentations || []).entries()) validateRequirements(presentation.requires,`story.npcs.${npcId}.presentations[${index}].requires`,errors);
    for (const [index, disclosure] of (npc.conversation?.conditionalFacts || []).entries()) {
      if (!disclosure?.fact || !Array.isArray(disclosure?.requires) || !disclosure.requires.length) errors.push(`story.npcs.${npcId}.conversation.conditionalFacts[${index}] needs fact and requirements.`);
      validateRequirements(disclosure?.requires, `story.npcs.${npcId}.conversation.conditionalFacts[${index}].requires`, errors);
    }
  }

  const clues = story.clues || {};
  if (!Object.keys(clues).length) errors.push("story.clues must contain authored discoveries.");
  for (const [clueId, clue] of Object.entries(clues)) {
    if (!clue?.fact || !clue?.unlocks) errors.push(`story.clues.${clueId} needs fact and unlocks.`);
    if (!Array.isArray(clue?.sources) || !clue.sources.length) {
      errors.push(`story.clues.${clueId}.sources must contain at least one discovery route.`);
      continue;
    }
    if (clue.essential && clue.sources.length < 2) {
      errors.push(`Essential clue '${clueId}' needs at least two independent authored sources.`);
    }
    for (const [index, source] of clue.sources.entries()) {
      if (!adventure.locations[source?.location]) errors.push(`story.clues.${clueId}.sources[${index}] references unknown location '${source?.location || "(missing)"}'.`);
      if (source?.npc && !npcs[source.npc]) errors.push(`story.clues.${clueId}.sources[${index}] references unknown NPC '${source.npc}'.`);
      if (!Array.isArray(source?.methods) || !source.methods.length || !source?.outcome) {
        errors.push(`story.clues.${clueId}.sources[${index}] needs methods and outcome.`);
      }
    }
  }

  if (!story.improvisation?.allowed?.length || !story.improvisation?.forbidden?.length) {
    errors.push("story.improvisation must define non-empty allowed and forbidden lists.");
  }
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
    if (location.aliases != null && (!Array.isArray(location.aliases) || location.aliases.some((alias) => typeof alias !== "string" || !alias.trim()))) errors.push(`locations.${locationId}.aliases must contain non-empty strings.`);
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
        for (const [index, presentation] of (feature.presentations || []).entries()) {
          validateRequirements(presentation?.requires, `locations.${locationId}.features.${feature.id}.presentations[${index}].requires`, errors);
          validateRequirements(presentation?.forbids, `locations.${locationId}.features.${feature.id}.presentations[${index}].forbids`, errors);
        }
      }
    }
    if (!Array.isArray(location.exits)) {
      errors.push(`locations.${locationId}.exits must be an array.`);
      continue;
    }
    for (const [index, beat] of (location.entryBeats || []).entries()) {
      if (!beat?.id || !beat?.npc || !beat?.text) errors.push(`locations.${locationId}.entryBeats[${index}] needs id, npc, and text.`);
      if (beat?.npc && !adventure.story?.npcs?.[beat.npc]) errors.push(`locations.${locationId}.entryBeats[${index}] references unknown NPC '${beat.npc}'.`);
      validateRequirements(beat.requires,`locations.${locationId}.entryBeats[${index}].requires`,errors);
    }
    for (const [index, exit] of location.exits.entries()) {
      if (!exit?.to || !adventure.locations[exit.to]) {
        errors.push(`locations.${locationId}.exits[${index}] points to unknown location '${exit?.to || "(missing)"}'.`);
      }
      if (!exit?.via) errors.push(`locations.${locationId}.exits[${index}].via is required.`);
      if (exit?.direction && !["up","down"].includes(exit.direction)) errors.push(`locations.${locationId}.exits[${index}].direction must be up or down when supplied.`);
      if (exit?.leadsFrom != null && (!Array.isArray(exit.leadsFrom)
        || exit.leadsFrom.some((id) => !location.features?.some((feature) => feature.id === id)))) {
        errors.push(`locations.${locationId}.exits[${index}].leadsFrom must reference local feature IDs.`);
      }
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

  const encounterIds=new Set();
  for (const encounter of adventure.encounters || []) {
    const path=`encounters.${encounter.id}`;
    if (!encounter.id || encounterIds.has(encounter.id)) errors.push(`${path} needs a unique id.`);
    encounterIds.add(encounter.id);
    if (!adventure.locations[encounter.location]) errors.push(`${path} references an unknown location.`);
    if (!Object.hasOwn(adventure.initialFlags || {},encounter.resolvedFlag) || adventure.initialFlags[encounter.resolvedFlag] !== false) errors.push(`${path} needs an initially false resolvedFlag.`);
    if (!encounter.opening || !encounter.victoryText) errors.push(`${path} needs opening and victoryText.`);
    const enemy=encounter.enemy;
    if (!enemy?.id || !enemy.name || !Number.isFinite(enemy.ac) || !(enemy.hp>0)
      || !Number.isFinite(enemy.initiativeModifier) || !Number.isFinite(enemy.attackBonus)
      || !Number.isFinite(enemy.damageModifier) || !Array.isArray(enemy.damageDice) || enemy.damageDice.length !== 2
      || enemy.damageDice.some((value)=>!Number.isInteger(value) || value<1)) errors.push(`${path} needs a complete, valid enemy stat block.`);
    validateRequirements(encounter.requires,`${path}.requires`,errors);
    errors.push(...validateInteractions({...adventure,interactions:[{id:encounter.id,location:encounter.location,modes:["act"],verbs:["resolve"],targets:[encounter.enemy?.name || "enemy"],outcome:{message:encounter.victoryText},effects:encounter.victoryEffects || []}]}));
  }
  if (adventure.aftermath && (!adventure.aftermath.speaker || !adventure.aftermath.reply)) errors.push("aftermath needs speaker and reply.");
  for (const [index,scene] of (adventure.aftermath?.scenes || []).entries()) {
    const path=`aftermath.scenes[${index}]`;
    if (!adventure.locations[scene.location] || !scene.title || !scene.summary || !scene.requires?.length) errors.push(`${path} needs a known location, title, summary and conditions.`);
    validateRequirements(scene.requires,`${path}.requires`,errors);
    for (const action of scene.actions || []) {
      const interaction=adventure.interactions?.find((entry)=>entry.id === action.interactionId);
      if (!interaction || interaction.location !== scene.location || !interaction.modes.includes(action.mode) || !action.label || !action.text) errors.push(`${path}.actions must reference a local interaction with a supported mode, label and text.`);
    }
    if (scene.nextAdventure && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scene.nextAdventure)) errors.push(`${path}.nextAdventure must be a stable adventure slug.`);
  }
  if (adventure.milestones?.complete) {
    if (!adventure.milestones.complete.requires?.length) errors.push("milestones.complete needs explicit completion requirements.");
    validateRequirements(adventure.milestones.complete.requires,"milestones.complete.requires",errors);
  }
  validateStory(adventure, errors, warnings);
  errors.push(...validateInteractions(adventure));

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
