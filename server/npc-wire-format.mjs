// Short wire IDs reduce local-model output/prefill cost; canonical IDs remain
// unchanged in validation, saves and diagnostics. This is serialization only.
export function compactNpcRequest(request){
 if(!['npc-natural-performance','npc-natural-repair','npc-claim-review'].includes(request.kind))return {request,decode:value=>value};
 let input;try{input=JSON.parse(request.messages[1].content);}catch{return {request,decode:value=>value};}
 if(request.kind==='npc-claim-review'&&!input.candidate)return {request,decode:value=>value};
 if(request.kind!=='npc-claim-review'&&input.focusVersion!==2)return {request,decode:value=>value};
 const evidence=input.evidence || [],catalogue=input.availableKnowledge || [];
 const toWire=new Map(evidence.map((entry,index)=>[entry.id,'e'+index])),fromWire=new Map([...toWire].map(([id,short])=>[short,id]));
 const lookupToWire=new Map(catalogue.map((entry,index)=>[entry.id,'k'+index])),lookupFromWire=new Map([...lookupToWire].map(([id,short])=>[short,id]));
 const compact={...input,evidence:evidence.map(entry=>({id:toWire.get(entry.id),text:entry.text}))};
 const schema=structuredClone(request.schema);
 if(request.kind==='npc-claim-review'){
  // Citation-only receipts in statement order avoid making a slow local model
  // repeat the entire draft and long canonical IDs in its audit output.
  delete schema.properties.claims.items.properties.text;
  schema.properties.claims.items.required=['evidenceIds'];
  schema.properties.feedback.maxLength=120;
  compact.availableKnowledge=catalogue.map(entry=>({id:lookupToWire.get(entry.id),subjects:entry.subjects}));
  compact.candidate={...input.candidate,evidenceIds:input.candidate.evidenceIds.map(id=>toWire.get(id) || id)};
  if(evidence.length)schema.properties.claims.items.properties.evidenceIds.items.enum=[...fromWire.keys()];
  if(catalogue.length)schema.properties.lookupIds.items.enum=[...lookupFromWire.keys()];
 }else if(evidence.length)schema.properties.evidenceIds.items.enum=[...fromWire.keys()];
 const messages=[{...request.messages[0],content:request.messages[0].content+(request.kind==='npc-claim-review'?' Wire format: for each concrete statement return a claim containing ONLY evidenceIds, in statement order. Do not repeat statement wording. On accept feedback must be empty. Otherwise feedback is one actionable sentence, at most12 words.':'')},{...request.messages[1],content:JSON.stringify(compact)}];
 const decode=value=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return value;
  const result={...value};
  if(Array.isArray(result.evidenceIds))result.evidenceIds=result.evidenceIds.map(id=>fromWire.get(id) || id);
  if(Array.isArray(result.lookupIds))result.lookupIds=result.lookupIds.map(id=>lookupFromWire.get(id) || id);
  if(Array.isArray(result.claims))result.claims=result.claims.map((claim,index)=>claim&&typeof claim==='object'?{text:'Statement '+(index+1)+' in candidate',...claim,...(Array.isArray(claim.evidenceIds)?{evidenceIds:claim.evidenceIds.map(id=>fromWire.get(id) || id)}:{})}:claim);
  return result;
 };
 return {request:{...request,messages,schema},decode};
}
