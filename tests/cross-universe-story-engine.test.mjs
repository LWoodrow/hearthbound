import test from "node:test";
import assert from "node:assert/strict";
import { hysteriaImpossibleFossil } from "../server/adventures/hysteria-impossible-fossil.mjs";
import { unmaskedClockmakerCase, unmaskedCaseDossier } from "../server/adventures/unmasked-clockmaker-case.mjs";
import { createCanonicalState, resolveAuthoredInteraction } from "../server/interaction-engine.mjs";
import { createCaseState, evaluateAccusation, projectSuspectKnowledge, recordEvidence, validateCaseDossier } from "../server/case-engine.mjs";

const run=(definition,state,action)=>resolveAuthoredInteraction({definition,state,action,mode:"act"});

test("Hysteria reuses canonical interactions for evidence, exposure, resources, and irreversible aftermath",()=>{
  let state=createCanonicalState(hysteriaImpossibleFossil,{currentLocation:"fossil-trench",visited:["base-camp","fossil-trench"]});
  let result=run(hysteriaImpossibleFossil,state,"measure the fossil sections");
  assert.equal(result.handled,true); state=result.state;
  assert.equal(state.clocks.exposure,1);
  state=createCanonicalState(hysteriaImpossibleFossil,{...state,currentLocation:"archive-tent",visited:[...state.visited,"archive-tent"]});
  result=run(hysteriaImpossibleFossil,state,"decode the prior notebook warning"); state=result.state;
  state=createCanonicalState(hysteriaImpossibleFossil,{...state,currentLocation:"fossil-trench"});
  result=run(hysteriaImpossibleFossil,state,"place the three fixed anchors");
  assert.equal(result.state.resources.anchors,0);
  assert.equal(result.state.flags.contained,true);
  assert.ok(result.state.discoveries.includes("aftermath-residue"));
});

test("Unmasked keeps immutable truth, evidence provenance, knowledge projections, and fair accusation gates",()=>{
  assert.deepEqual(validateCaseDossier(unmaskedCaseDossier),[]);
  const fresh=createCaseState(unmaskedCaseDossier);
  const truth=fresh.truthHash;
  let state=recordEvidence(unmaskedCaseDossier,fresh,"cordial-residue").state;
  state=recordEvidence(unmaskedCaseDossier,state,"east-door-print").state;
  state=recordEvidence(unmaskedCaseDossier,state,"ledger-page").state;
  assert.equal(state.truthHash,truth);
  assert.equal(projectSuspectKnowledge(unmaskedCaseDossier,"mara-quill",state).observations.length,1);
  assert.deepEqual(evaluateAccusation(unmaskedCaseDossier,state,"elias-voss",state.evidence),{accepted:true,correct:true,missing:[],resolved:true});
  assert.equal(evaluateAccusation(unmaskedCaseDossier,state,"mara-quill",state.evidence).correct,false);
});

test("Unmasked evidence interactions execute without case-specific resolver code",()=>{
  let state=createCanonicalState(unmaskedClockmakerCase);
  const result=run(unmaskedClockmakerCase,state,"test the victim cordial glass");
  assert.equal(result.handled,true);
  assert.ok(result.state.discoveries.includes("cordial-residue"));
});
