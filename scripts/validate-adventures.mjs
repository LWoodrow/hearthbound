import { allAdventureDefinitions } from "../server/adventure-registry.mjs";
import { validateAdventure } from "../server/adventure-schema.mjs";

let failed = false;

for (const adventure of allAdventureDefinitions()) {
  const validation = validateAdventure(adventure);
  if (!validation.valid) {
    failed = true;
    console.error(`${adventure.title}: invalid`);
    validation.errors.forEach((error) => console.error(`  - ${error}`));
    continue;
  }

  console.log(`${adventure.title}: valid (${Object.keys(adventure.locations).length} locations)`);
  validation.warnings.forEach((warning) => console.warn(`  warning: ${warning}`));
}

if (failed) process.exitCode = 1;
