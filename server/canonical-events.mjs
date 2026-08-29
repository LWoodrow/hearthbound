const stable = (value) => JSON.stringify(value ?? null);

export function deriveCanonicalEvents(before = {}, after = {}, { interactionIds = [] } = {}) {
  const revision = Number(after.revision || 0);
  if (revision <= Number(before.revision || 0)) return [];
  const events = [];
  if (before.currentLocation !== after.currentLocation) events.push({ type:"location-entered", revision, locationId:after.currentLocation, previousLocationId:before.currentLocation || null });
  for (const id of after.discoveries || []) if (!(before.discoveries || []).includes(id)) events.push({ type:"discovery-recorded", revision, discoveryId:id });
  for (const [objectId, value] of Object.entries(after.objects || {})) {
    const previous = before.objects?.[objectId] || {};
    const changes = Object.fromEntries(Object.entries(value || {}).filter(([key, next]) => stable(previous[key]) !== stable(next)));
    if (Object.keys(changes).length) events.push({ type:"object-state-changed", revision, objectId, changes });
  }
  for (const interactionId of interactionIds) events.push({ type:"interaction-completed", revision, interactionId });
  return events;
}

export function recordCanonicalTransition(before, after, metadata = {}) {
  const canonicalEvents = deriveCanonicalEvents(before, after, metadata);
  if (!canonicalEvents.length) return { state:after, canonicalEvents };
  const revision = Number(after.revision || 0);
  const outcomes = [...(after.outcomes || [])];
  const existing = outcomes.findIndex((entry) => Number(entry.revision) === revision);
  const record = { ...(existing >= 0 ? outcomes[existing] : {}), revision, canonicalEvents };
  if (existing >= 0) outcomes[existing] = record;
  else outcomes.push(record);
  return { state:{ ...after, outcomes:outcomes.slice(-100) }, canonicalEvents };
}
