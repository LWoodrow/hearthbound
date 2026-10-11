// Authored open walking areas, not graph-wide pathfinding. Members must be
// deliberately reviewed public destinations; private rooms/depths stay outside.
// Compile into ordinary exits so interpretation, UI, checks and persistence use
// exactly the same executor. Illustrated street lines need not be a click chain.
export function connectPublicAreas(locations, areas) {
  const result = {...locations};
  const assigned = new Set();
  for (const area of areas) {
    const members = area.members.map(member => typeof member === 'string' ? {id:member} : member);
    for (const member of members) {
      if (!locations[member.id]) throw new Error(`Unknown public destination: ${member.id}`);
      if (assigned.has(member.id)) throw new Error(`Overlapping public areas: ${member.id}`);
      assigned.add(member.id);
      // Existing guarded approaches must be explicitly represented on the
      // public entrance too. Otherwise a new source could bypass that door.
      for (const exit of Object.values(locations).flatMap(location=>location.exits || []).filter(exit=>exit.to===member.id)) {
        if (exit.object && member.object!==exit.object)
          throw new Error(`Guarded destination needs an explicit public entrance door: ${member.id}`);
        if ((exit.requires || []).some(requirement=>!(member.requires || []).some(publicRequirement=>JSON.stringify(publicRequirement)===JSON.stringify(requirement))))
          throw new Error(`Guarded destination needs explicit public entrance requirements: ${member.id}`);
      }
    }
    for (const source of members) {
      const location = locations[source.id];
      const exits = (location.exits || []).map(exit => {
        const target=members.find(member=>member.id===exit.to);
        if (!target) return exit;
        if (target.object && exit.object && target.object!==exit.object)
          throw new Error(`Conflicting public entrance doors: ${target.id}`);
        return {...exit, requires:[...(exit.requires || []),...(target.requires || [])],
          ...(target.object && !exit.object ? {object:target.object} : {})};
      });
      for (const target of members) {
        // An authored edge (including its door/prerequisite) is never replaced
        // or duplicated by an unguarded public shortcut.
        if (target.id === source.id || exits.some(exit => exit.to === target.id)) continue;
        exits.push({to:target.id, via:`public walk to ${locations[target.id].name}`,
          publicArea:area.id, ...(target.requires ? {requires:target.requires} : {}),
          ...(target.object ? {object:target.object} : {})});
      }
      result[source.id] = {...location, publicArea:area.id, exits};
    }
  }
  return result;
}
