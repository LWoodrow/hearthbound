import { meaningfulReferenceWords, normaliseText, tokenEquivalent, isGreeting } from "./semantic-tokens.mjs";

// The model selects identifiers, never factual prose. Rendering copies current
// authored facts verbatim, so empty citations cannot license invented services.
export const npcFactSelectionSchema = {type:"object",properties:{factIds:{type:"array",items:{type:"integer"}}},required:["factIds"],additionalProperties:false};
const conversationalWords = new Set(["tell","know","about","any","need","needs","help","what","who","where","how","there","here","anything","something"]);
export function conversationFacts(facts) {
  return [...new Set(facts)].filter(fact => typeof fact === "string" && !/not implemented|unrecorded|main.story progress|hidden campaign/i.test(fact));
}
export function relevantNpcFacts(action, facts) {
  const words=normaliseText(action);
  const tokens=meaningfulReferenceWords(action).filter(word=>!conversationalWords.has(word));
  const work=/\b(help|work|jobs?|quests?|troubles?|problems?)\b/.test(words);
  return facts.map((fact,id)=>{
    const terms=meaningfulReferenceWords(fact);
    const overlap=tokens.filter(token=>terms.some(term=>tokenEquivalent(token,term))).length;
    const task=work && /\b(damaged|frayed|repair|report|request|contract|help|trouble|restored|repaired)\b/i.test(fact) ? 2 : 0;
    return {id,score:overlap+task};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.id-b.id).slice(0,2).map(item=>item.id);
}
export function renderNpcFacts(npc, facts, selection) {
  if (!selection || Object.keys(selection).some(key=>key!=="factIds") || !Array.isArray(selection.factIds)
    || selection.factIds.length>2 || selection.factIds.some(id=>!Number.isInteger(id)||id<0||id>=facts.length)
    || new Set(selection.factIds).size!==selection.factIds.length) return null;
  return selection.factIds.length ? `“${selection.factIds.map(id=>facts[id]).join(" ")}”` : null;
}
export function factualNpcFallback(npc, action, facts) {
  const words=normaliseText(action);
  if(isGreeting(action))return `“Hello,” ${npc.name} says. “What would you like to know?”`;
  if(/\b(who are you|your name|yourself)\b/.test(words))return `“I'm ${npc.name}, ${npc.role}.”`;
  if(/^(?:thank you|thanks)(?: very much| so much)?$/.test(words))return `“You're welcome,” ${npc.name} replies.`;
  // A conversation cannot fulfil commerce. This is a capability boundary, not
  // a pretend transaction or a list of provider-specific forbidden phrases.
  if(/\b(buy|purchase|order|serve|give|bring|food|eat|drink|menu|stew|ales?|beer|cider|oatcakes?|bread|rent|hire|lodging)\b/.test(words)) {
    const serviceFacts=facts.filter(fact=>/\b(serves?|food|drink|menu|stew|ales?|beer|cider|oatcakes?|bread|lodging)\b/i.test(fact));
    const answer=renderNpcFacts(npc,serviceFacts,{factIds:serviceFacts.length?[0]:[]});
    return answer ? answer + " “That's what I can tell you; I can't arrange a purchase or hand anything over.”"
      : `“We can talk here, but I can't arrange that for you.”`;
  }
  return renderNpcFacts(npc,facts,{factIds:relevantNpcFacts(action,facts)})
    || `${npc.name} considers the question. “I don't know enough to give you a useful answer to that.”`;
}
export function isSimpleNpcSpeech(action) {
  return isGreeting(action) || /^(?:thank you|thanks)(?: very much| so much)?$/.test(normaliseText(action))
    || /\b(who are you|your name|yourself|buy|purchase|order|serve|give|bring|food|eat|drink|menu|stew|ales?|beer|cider|oatcakes?|bread|rent|hire|lodging)\b/.test(normaliseText(action));
}

// An explicit address to a known absent resident must not silently fall through
// to the current conversation partner. Mentioning a person later in a question
// ("where is Jory?") is not addressing that person.
export function absentNpcAddress(definition, action, canHear) {
  const words=normaliseText(action);
  return Object.entries(definition.story?.npcs || {}).some(([id,npc])=>{
    const first=normaliseText(npc.name).split(" ")[0];
    const prefixes=[first,normaliseText(npc.name)];
    return !canHear(npc) && prefixes.some(name=>words===name||words.startsWith(name+" ")||["hi ","hello ","hey "].some(g=>words===g+name||words.startsWith(g+name+" ")));
  });
}
