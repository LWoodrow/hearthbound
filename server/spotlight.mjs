export function normalizeSpeechAudience(mode, audience) {
  if (mode !== "speak") return null;
  return audience === "nearby" ? "nearby" : "party";
}

export function actionUsesSpotlight(mode, audience = null) {
  return mode === "act" || (mode === "speak" && normalizeSpeechAudience(mode, audience) === "nearby");
}

export function canSubmitOutsideCombat({ mode, audience, partySize, spotlightPlayerId, playerId }) {
  // Exploration and roleplay are free-flowing at this family table. Initiative
  // remains authoritative during combat, but no saved spotlight may lock a
  // family member out of acting or speaking between encounters.
  return true;
}
