import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateDialogue,scenarios,summarizeDialogueRun} from '../scripts/evaluate-one-pass-dialogue.mjs';

test('dialogue replay metrics do not mislabel structural success as semantic acceptance',()=>{
 const summary=summarizeDialogueRun([
  {elapsedMs:800,calls:1,status:{},canonicalUnchanged:true,pendingCheck:null,prompts:[{estimatedInputTokens:100}]},
  {elapsedMs:2000,calls:2,status:{repaired:true,unavailable:true},canonicalUnchanged:true,pendingCheck:null,prompts:[{estimatedInputTokens:200}]},
  {elapsedMs:10,calls:0,status:{},canonicalUnchanged:true,pendingCheck:{dc:14},prompts:[]},
 ]);
 assert.equal(summary.turns,3);assert.equal(summary.medianMs,800);assert.equal(summary.totalCalls,3);
 assert.equal(summary.singleCallTurns,1);assert.equal(summary.repairedTurns,1);assert.equal(summary.unavailableTurns,1);
 assert.equal(summary.pendingChecks,1);assert.equal(summary.canonicalChanges,0);assert.equal(summary.largestEstimatedInputTokens,200);
 assert.match(summary.semanticQuality,/Requires human reading/);assert.equal(summarizeDialogueRun([]).medianMs,null);
});

test('contaminated-memory replay uses a fresh memory save for every run and preserves authority boundaries',async()=>{
 const profile={id:'test',version:1,model:'test',contextTokens:8192},seen=[];
 for(let run=1;run<=2;run++){
  const emitted=[];
  const result=await evaluateDialogue({profile,scenario:scenarios['nima-memory'],limit:1,run,emit:value=>emitted.push(value),generate:async(_profile,messages)=>{
   seen.push(messages);const data=JSON.parse(messages.at(-1).content);
   assert.match(messages.find(message=>message.role==='assistant').content,/Copper Swan/);
   assert.doesNotMatch(JSON.stringify(data.sources.established),/Copper Swan|older brother/);
   return {kind:'speech',reply:'Maren is my younger sister. She mends clothes.',ids:[],approach:''};
  }});
  assert.equal(result.summary.totalCalls,1);assert.equal(result.summary.canonicalChanges,0);assert.equal(result.summary.turns,1);
  assert.equal(emitted.length,2);assert.equal(emitted[0].run,run);assert.ok(emitted[0].prompts[0].estimatedInputTokens>0);
 }
 assert.equal(seen.length,2);assert.equal(seen[0].length,seen[1].length,'second run starts fresh, not with the first generated turn');
});
