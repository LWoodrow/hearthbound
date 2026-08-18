const clone = (value) => JSON.parse(JSON.stringify(value));

export function createCaseState(dossier, seed = dossier.seed || dossier.id) {
  return Object.freeze({
    schemaVersion:1,
    caseId:dossier.id,
    seed:String(seed),
    truthHash:JSON.stringify({ culprit:dossier.culprit, timeline:dossier.timeline }),
    time:0,
    evidence:[],
    custody:{},
    statements:[],
    accusations:[],
    resolved:false,
  });
}

export function projectSuspectKnowledge(dossier, suspectId, state) {
  const suspect = dossier.suspects?.[suspectId];
  if (!suspect) return null;
  const earned = new Set(state.evidence || []);
  return {
    id:suspectId,
    name:suspect.name,
    observations:(suspect.observations || []).filter((item) => !item.requires || earned.has(item.requires)),
    beliefs:clone(suspect.beliefs || []),
    permittedDisclosures:clone(suspect.permittedDisclosures || []),
    deliberateLies:clone(suspect.deliberateLies || []),
  };
}

export function recordEvidence(dossier, suppliedState, evidenceId, custodian = "party") {
  if (!dossier.evidence?.[evidenceId]) return { accepted:false, state:suppliedState, reason:"unknown-evidence" };
  if ((suppliedState.evidence || []).includes(evidenceId)) return { accepted:true, repeated:true, state:suppliedState };
  const state = { ...suppliedState, evidence:[...(suppliedState.evidence || []), evidenceId], custody:{ ...(suppliedState.custody || {}), [evidenceId]:custodian } };
  return { accepted:true, state:Object.freeze(state) };
}

export function evaluateAccusation(dossier, suppliedState, suspectId, evidenceIds = []) {
  const supplied = new Set(evidenceIds);
  const requirements = dossier.accusationRequirements || [];
  const missing = requirements.filter((requirement) => !requirement.some((id) => supplied.has(id) && suppliedState.evidence.includes(id)));
  const correct = suspectId === dossier.culprit && missing.length === 0;
  return { accepted:missing.length === 0, correct, missing, resolved:correct };
}

export function validateCaseDossier(dossier) {
  const errors = [];
  if (!dossier?.id || !dossier?.culprit || !dossier?.motive || !dossier?.method || !dossier?.opportunity) errors.push("Case dossier needs id, culprit, motive, method, and opportunity.");
  if (!dossier?.suspects?.[dossier?.culprit]) errors.push("Culprit must be one of the suspects.");
  if (!Array.isArray(dossier?.timeline) || !dossier.timeline.length) errors.push("Case dossier needs a ground-truth timeline.");
  const evidence = dossier?.evidence || {};
  for (const [id, item] of Object.entries(evidence)) if (!item.provenance || !item.source) errors.push(`Evidence '${id}' needs provenance and source.`);
  for (const [index, group] of (dossier?.accusationRequirements || []).entries()) {
    if (!Array.isArray(group) || !group.length) errors.push(`Accusation requirement ${index} must offer at least one evidence route.`);
    for (const id of group || []) if (!evidence[id]) errors.push(`Accusation requirement references unknown evidence '${id}'.`);
  }
  return errors;
}
