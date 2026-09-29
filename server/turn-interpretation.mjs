import { observationReferenceText, parseLiteralIntent } from "./intent-resolver.mjs";
import { resolveSceneReference } from "./scene-reference-resolver.mjs";
import { classifyWorldAction } from "./world-state.mjs";

// Interpret a player turn once against the current command surface. The
// authored and ordinary world resolvers must not independently rediscover a
// different target from the same sentence.
export function interpretSceneTurn(surface, action, mode = "act") {
  const worldIntent = classifyWorldAction(action, mode);
  const parsed = parseLiteralIntent(action, mode);
  const sceneIntent = worldIntent === "pickup" ? "take"
    : worldIntent === "object" ? "open"
    : worldIntent === "speech" ? "speak"
    : worldIntent === "other" ? parsed.verb
    : worldIntent;
  const referenceText = worldIntent === "observe" ? observationReferenceText(action) : String(action || "").trim();
  const sceneReference = resolveSceneReference({ surface, action:referenceText, mode, intent:sceneIntent, parsed });
  return { action, mode, worldIntent, parsed, referenceText, sceneReference };
}
