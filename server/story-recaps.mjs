const clean = (value, limit = 240) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
const unique = (items, limit) => [...new Set(items.filter(Boolean))].slice(-limit);

export function buildAuthoritativeRecap({ campaign, events = [], knownLocations = [], party = [], roomAuthority = null, pendingCheck = null }) {
  const visibleEvents = events.filter((event) => event?.visibility !== "dm");
  const establishedFacts = unique(visibleEvents.flatMap((event) => {
    const facts = event?.payload?.authoritativeFacts;
    return Array.isArray(facts) ? facts.map((fact) => clean(fact, 320)) : [];
  }), 6);
  const recentActions = unique(visibleEvents.filter((event) => event.kind === "action").map((event) => `${clean(event.speaker, 60)} ${clean(event.text, 280)}`), 4);
  const recentRolls = unique(visibleEvents.filter((event) => event.kind === "roll").map((event) => clean(event.text, 320)), 3);
  const campaignUpdates = unique(visibleEvents.filter((event) => event.kind === "system" && !["Inventory", "Combat"].includes(event.speaker)).map((event) => clean(event.text, 320)), 3);
  const carriedItems = party.flatMap((member) => (member.inventory || []).map((item) => `${clean(member.name, 60)}: ${clean(item.name, 100)}${Number(item.quantity || 1) > 1 ? ` ×${Number(item.quantity)}` : ""}`)).slice(0, 16);
  const places = knownLocations.slice(-6).map((location) => ({ name:clean(location.name, 100), summary:clean(location.summary, 240) }));
  return {
    version:1,
    title:clean(campaign?.title || "Current adventure", 100),
    currentLocation:clean(roomAuthority?.currentLocation?.name || roomAuthority?.currentLocation?.label || campaign?.scene || places.at(-1)?.name || "Current scene", 120),
    visibleFeatures:(roomAuthority?.currentLocation?.features || roomAuthority?.currentFeatures || []).map((feature) => clean(feature, 100)).filter(Boolean).slice(0, 10),
    establishedFacts,
    recentActions,
    recentRolls,
    campaignUpdates,
    carriedItems,
    knownLocations:places,
    pendingCheck:pendingCheck ? `${clean(pendingCheck.ability, 30)} (${clean(pendingCheck.skill, 50)}) DC ${Number(pendingCheck.dc)}` : "",
  };
}
