// AI determines whether the available biography actually answers a personal
// question BEFORE writing dialogue. Absence is not a negative historical fact.
export const answerPlanSchema={type:'object',properties:{
 question:{type:'string',minLength:1,maxLength:240},
 knowledge:{type:'string',enum:['supported','partial','unknown']},
 supportIds:{type:'array',maxItems:4,items:{type:'string'}},
 unknown:{type:'string',maxLength:220},
},required:['question','knowledge','supportIds','unknown'],additionalProperties:false};
export function validAnswerPlan(value,evidence){
 if(!value||Object.keys(value).length!==4||!['question','knowledge','supportIds','unknown'].every(key=>Object.hasOwn(value,key))||typeof value.question!=='string'||!value.question.trim()||value.question.length>240||!['supported','partial','unknown'].includes(value.knowledge)||typeof value.unknown!=='string'||value.unknown.length>220||!Array.isArray(value.supportIds)||value.supportIds.length>4||new Set(value.supportIds).size!==value.supportIds.length||value.supportIds.some(id=>!evidence.some(entry=>entry.id===id)))return false;
 return value.knowledge==='supported'?value.supportIds.length>0&&!value.unknown.trim():!!value.unknown.trim()&&(value.knowledge!=='unknown'||!value.supportIds.length);
}
export async function planPersonalAnswer({packet,evidence,generate}){
 const schema=structuredClone(answerPlanSchema);
 if(evidence.length)schema.properties.supportIds.items.enum=evidence.map(entry=>entry.id);
 else schema.properties.supportIds.maxItems=0;
 const generated=await generate({kind:'npc-answer-plan',schema,generation:{temperature:0,numPredict:150,timeoutMs:45000},messages:[
  {role:'system',content:'Assess answerability, not dialogue. The HUMAN asks this NPC the newest question. Resolve references from recent dialogue. CURRENT evidence is the only authority for personal biography. A fact that a relative or venue exists does NOT establish whether the NPC ever visited it with that person. Absence of a visit record means UNKNOWN, never "has not visited". A restaurant recommendation is not a personal memory. Prior generated replies are not evidence. State the precise current question with the NPC as subject. knowledge=supported only when sources directly answer it; partial when only part is known; unknown otherwise. supportIds must support the actual answer, not just name related people/places. unknown briefly names missing information. No replacement prose, no reasoning essay.'},
  {role:'user',content:JSON.stringify({npc:packet.npc,evidence:evidence.map(({id,text})=>({id,text})),history:packet.history,immediateExchange:packet.history?.at(-1),newestSpeech:packet.newestSpeech})},
 ]});
 const plan=generated.output || generated;
 return validAnswerPlan(plan,evidence)?plan:null;
}
