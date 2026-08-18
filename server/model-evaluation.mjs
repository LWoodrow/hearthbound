const REQUIRED_FACT_WEIGHT=4;
export const MODEL_EVALUATION_VERSION=1;

export function scoreNarration(sample, response) {
  const text=String(response?.text || "").toLowerCase();
  const required=(sample.requiredFacts || []).filter((fact)=>text.includes(String(fact).toLowerCase()));
  const forbidden=(sample.forbiddenTerms || []).filter((term)=>text.includes(String(term).toLowerCase()));
  const repeated=(sample.repetitionTerms || []).filter((term)=>text.split(String(term).toLowerCase()).length-1>1);
  return {
    sampleId:sample.id,
    faithfulness:required.length/Math.max(1,(sample.requiredFacts || []).length),
    inventionRate:forbidden.length/Math.max(1,(sample.forbiddenTerms || []).length),
    repetitionRate:repeated.length/Math.max(1,(sample.repetitionTerms || []).length),
    requiredMatched:required,
    forbiddenMatched:forbidden,
    latencyMs:Number(response?.latencyMs || 0),
    score:required.length*REQUIRED_FACT_WEIGHT-forbidden.length*5-repeated.length,
  };
}

export function compareModelRuns(samples, runsByProfile) {
  return Object.fromEntries(Object.entries(runsByProfile).map(([profileId,responses])=>{
    const results=samples.map((sample,index)=>scoreNarration(sample,responses[index] || {}));
    return [profileId,{version:MODEL_EVALUATION_VERSION,profileId,samples:results,meanFaithfulness:results.reduce((n,r)=>n+r.faithfulness,0)/Math.max(1,results.length),meanInventionRate:results.reduce((n,r)=>n+r.inventionRate,0)/Math.max(1,results.length),meanLatencyMs:results.reduce((n,r)=>n+r.latencyMs,0)/Math.max(1,results.length)}];
  }));
}
