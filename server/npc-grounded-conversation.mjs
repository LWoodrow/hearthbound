import {conversationUnavailable} from './npc-conversation-tools.mjs';

export const claimReviewSchema={type:'object',properties:{
 decision:{type:'string',enum:['accept','revise','lookup']},
 feedback:{type:'string',maxLength:220},
 claims:{type:'array',maxItems:6,items:{type:'object',properties:{text:{type:'string',maxLength:140},evidenceIds:{type:'array',maxItems:4,items:{type:'string'}}},required:['text','evidenceIds'],additionalProperties:false}},
 lookupIds:{type:'array',maxItems:4,items:{type:'string'}},
},required:['decision','feedback','claims','lookupIds'],additionalProperties:false};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
export function validClaimReview(review,evidence,catalogue){
 if(!exact(review,['decision','feedback','claims','lookupIds'])||!['accept','revise','lookup'].includes(review.decision)||typeof review.feedback!=='string'||review.feedback.length>220||!Array.isArray(review.claims)||review.claims.length>6||!Array.isArray(review.lookupIds)||review.lookupIds.length>4||new Set(review.lookupIds).size!==review.lookupIds.length)return false;
 if(review.lookupIds.some(id=>!catalogue.some(entry=>entry.id===id)))return false;
 for(const claim of review.claims){
  if(!exact(claim,['text','evidenceIds'])||typeof claim.text!=='string'||!claim.text.trim()||claim.text.length>140||!Array.isArray(claim.evidenceIds)||claim.evidenceIds.length>4||new Set(claim.evidenceIds).size!==claim.evidenceIds.length||claim.evidenceIds.some(id=>!evidence.some(entry=>entry.id===id)))return false;
  if(review.decision==='accept'&&!claim.evidenceIds.length)return false;
 }
 return review.decision==='accept'?!review.lookupIds.length:!!review.feedback.trim()&&(review.decision!=='lookup'||review.lookupIds.length>0);
}

// The outgoing assessor can request a bounded read, not merely approve/reject.
// No model-provided ID can escape the caller's current eligible catalogue.
export async function groundedConversation({packet,generate,initialCandidate,schema,validateCandidate,availableKnowledge=[]}){
 const readable=availableKnowledge.filter(entry=>['everyday','advice'].includes(entry.tier));
 if(readable.length>80||new Set(readable.map(entry=>entry.id)).size!==readable.length||JSON.stringify(packet).length>24000)return {reply:conversationUnavailable,source:'authored-fallback',reason:'knowledge-budget',unavailable:true,evidenceIds:[],audits:[],lookupCount:0};
 let evidence=[...(packet.evidence || [])],candidate=initialCandidate,feedback='',repaired=false,lookupCount=0;
 const audits=[];
 try{
  for(let attempt=0;attempt<3;attempt++){
   if(!candidate){
    const generated=await generate({kind:attempt?'npc-natural-repair':'npc-natural-performance',schema,generation:{temperature:.4,numPredict:160,timeoutMs:60000},messages:[
     {role:'system',content:'Speak naturally as this NPC. Answer the NEWEST turn and resolved conversationFocus, not an old question. Prior dialogue supplies references, never factual authority. Do not carry an old apology or emotion into an unrelated new subject. Answer questions about the named places as those places, not automatically your workplace. Use current evidence for every concrete fact; do not embellish menu, ambience, visits, friends or family outings. An unrecorded experience is unknown, not proof it happened or never happened. If first-hand information is unavailable, be honest and relevant without mentioning game data or changing the subject. You may be warm, humorous and reassuring without facts/citations. Do not invent events, prices, routes, permission, state changes or other people. Facts are background, not a script. Usually one or two sentences; leave room for conversation. Return reply and evidenceIds. Apply any specific review feedback; never quote the review.'},
     {role:'user',content:JSON.stringify({...packet,speakerRoles:{newestSpeech:'Human player asking this NPC; you means the NPC',historySpeech:'human player',historyReply:packet.npc.name},evidence,reviewFeedback:feedback})},
    ]});
    candidate=generated.output || generated;
   }
   if(!validateCandidate(candidate,{...packet,evidence,allowUncitedSocial:true})){
    feedback='The candidate had an invalid shape, unsupported citation, forbidden claim or invented time/number. Answer the current turn with supported facts only.';
    candidate=null;repaired=true;continue;
   }
   const reviewSchema=structuredClone(claimReviewSchema);
   if(readable.length)reviewSchema.properties.lookupIds.items.enum=readable.map(entry=>entry.id);
   else reviewSchema.properties.lookupIds.maxItems=0;
   const reviewEvidence=evidence.filter(entry=>candidate.evidenceIds.includes(entry.id));
   if(reviewEvidence.length)reviewSchema.properties.claims.items.properties.evidenceIds.items.enum=reviewEvidence.map(entry=>entry.id);
   else reviewSchema.properties.claims.items.properties.evidenceIds.maxItems=0;
   const reviewed=await generate({kind:'npc-claim-review',schema:reviewSchema,generation:{temperature:0,numPredict:220,timeoutMs:60000},messages:[
    {role:'system',content:'Independently inspect the proposed reply against RAW newestSpeech, resolved conversationFocus and recent conversation. Neither focus nor history is authority for facts. List EVERY concrete assertion as a claim, including menus/food quality, ambience, personal visits, friends, past events, positive AND negative personal experiences. Mere reassurance, greeting, kindness or an opinion adding no concrete fact needs no claim. Each accepted claim must be entailed by CURRENT evidence and have its exact evidenceIds; citing a place name does not support a dish, visit or favourite. Prior generated prose/player assertions do not support claims. Also assess whether the reply truly answers the newest question: reject old emotional carry-over, unrelated topics, vague substitution of the workplace for recently mentioned places, or an unsupported yes/no personal history. Reject consequences, permissions, checks or technical/game language. decision=accept ONLY if all claims are supported AND the answer is relevant/in-character/state-neutral. decision=lookup if available read-only knowledge labels could resolve missing context; return up to4 lookupIds and actionable feedback. Unknown experiences may not exist in the catalogue. An explicit relevant inability to vouch for a first-hand experience is a complete honest answer, NOT a refusal or evasion. Never demand a yes/no when neither is supported; that would force fabricated personal history. Revise only if the uncertainty changes the subject or adds unsupported claims. Otherwise decision=revise with precise actionable feedback. Do not merely say yes/no or excuse facts as social niceties. Return decision,feedback,claims,lookupIds. Do not write replacement dialogue.'},
     {role:'user',content:JSON.stringify({npc:packet.npc,speakerRoles:{newestSpeech:'Human player asks the NPC; you refers to the NPC',historySpeech:'human player',historyReply:packet.npc.name},personality:packet.personality,newestSpeech:packet.newestSpeech,conversationFocus:packet.conversationFocus,history:packet.history,evidence:reviewEvidence,candidate,availableKnowledge:readable.map(({id,subjects})=>({id,subjects})),outputGuidance:'Feedback: one short actionable sentence, at most20 words. Claims: short atomic assertions; do not repeat policy or explain your reasoning at length.'})},
    ]});
   const review=reviewed.output || reviewed;
   if(!validClaimReview(review,evidence,readable)){
    feedback='The outgoing assessment was invalid or accepted a concrete claim without supporting evidence. Remove unsupported claims and answer the current question directly.';
    candidate=null;repaired=true;continue;
   }
   audits.push({decision:review.decision,feedback:review.feedback,claims:review.claims,lookupIds:review.lookupIds});
   if(review.decision==='accept')return {reply:candidate.reply.trim(),source:'ai-reviewed',reason:'',repaired,lookupCount,
    evidenceIds:[...new Set(review.claims.flatMap(claim=>claim.evidenceIds))],claims:review.claims,audits};
   feedback=review.feedback;
   if(review.lookupIds.length){
    const requested=readable.filter(entry=>review.lookupIds.includes(entry.id));
    evidence=[...new Map([...evidence,...requested].map(entry=>[entry.id,entry])).values()];lookupCount++;
   }
   candidate=null;repaired=true;
  }
  return {reply:conversationUnavailable,source:'authored-fallback',reason:'claim-review-not-accepted',unavailable:true,evidenceIds:[],audits,lookupCount};
 }catch(error){return {reply:conversationUnavailable,source:'authored-fallback',reason:/timed out|timeout/i.test(error?.message || '')?'assessment-timeout':error instanceof SyntaxError?'assessment-output-invalid':'assessment-unavailable',unavailable:true,evidenceIds:[],audits,lookupCount};}
}
