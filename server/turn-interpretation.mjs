import { observationReferenceText, parseLiteralIntent } from "./intent-resolver.mjs";
import { resolveSceneReference } from "./scene-reference-resolver.mjs";
import { classifyWorldAction } from "./world-state.mjs";

// Interpret a player turn once against the current command surface. The
// authored and ordinary world resolvers must not independently rediscover a
// different target from the same sentence.
export function interpretSceneTurn(surface, action, mode = "act") {
  let worldIntent = classifyWorldAction(action, mode);
  let parsed = parseLiteralIntent(action, mode);
  // Transitive move/shift/remove operates a thing; movement through/to a
  // route navigates. Unknown/remote things stay unhandled, not teleported.
  if (mode === "act" && /^(?:move|shift|remove)\s+/i.test(String(action).trim())
    && !/\b(?:to|towards?|through|into|out|up|down|back)\b/i.test(action)) {
    worldIntent = "other";
    parsed = {...parsed,verb:"use"};
  }
  const sceneIntent = worldIntent === "pickup" ? "take"
    : worldIntent === "object" ? "open"
    : worldIntent === "speech" ? "speak"
    : worldIntent === "other" ? parsed.verb
    : worldIntent;
  const referenceText = worldIntent === "observe" ? observationReferenceText(action) : String(action || "").trim();
  const sceneReference = resolveSceneReference({ surface, action:referenceText, mode, intent:sceneIntent, parsed });
  return { action, mode, worldIntent, parsed, referenceText, sceneReference };
}
