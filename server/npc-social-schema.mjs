import {practicalDomains} from './npc-knowledge-coverage.mjs';
const tiers=['everyday','advice','detail','solution'];
const skills=['Persuasion','Deception','Intimidation','Insight','Performance'];
export function validateNpcSocial(npc,id,definition) {
 const errors=[],prefix=`story.npcs.${id}`;
 const strings=value=>Array.isArray(value)&&value.every(item=>typeof item==='string'&&item.trim());
 const requirements=(value,path)=>{if(value!==undefined&&(!Array.isArray(value)||value.some(entry=>!entry||typeof entry.path!=='string'||!['equals','minimum','includes','truthy'].some(key=>Object.hasOwn(entry,key)))))errors.push(`${path} needs valid canonical prerequisites.`);};
 if(npc.personality){
  if(!strings(npc.personality.traits)||!npc.personality.traits.length||typeof npc.personality.mood!=='string')errors.push(`${prefix}.personality needs traits and a starting mood.`);
  for(const key of ['values','interests','mannerisms','boundaries','bonds'])if(npc.personality[key]!==undefined&&!strings(npc.personality[key]))errors.push(`${prefix}.personality.${key} must contain authored strings.`);
 }
 if(npc.conversation?.natural!==undefined&&typeof npc.conversation.natural!=='boolean')errors.push(`${prefix}.conversation.natural must be boolean.`);
 const seen=new Set();
 if(npc.conversation?.knowledge!==undefined&&!Array.isArray(npc.conversation.knowledge))errors.push(`${prefix}.conversation.knowledge must be an array.`);
 for(const entry of (Array.isArray(npc.conversation?.knowledge)?npc.conversation.knowledge:[])){
  if(!entry?.id||seen.has(entry.id)||typeof entry.text!=='string'||!entry.text.trim()||!tiers.includes(entry.tier)||!strings(entry.subjects))errors.push(`${prefix}.knowledge needs unique IDs, text, a disclosure tier and subjects.`);
  seen.add(entry?.id);requirements(entry?.requires,`${prefix}.knowledge.requires`);
  if(entry?.domain!==undefined&&!practicalDomains.includes(entry.domain))errors.push(`${prefix}.knowledge.domain must be a supported practical knowledge domain.`);
 }
 const ids=new Set();
 if(npc.socialChallenges!==undefined&&!Array.isArray(npc.socialChallenges))errors.push(`${prefix}.socialChallenges must be an array.`);
 for(const challenge of (Array.isArray(npc.socialChallenges)?npc.socialChallenges:[])){
  const path=`${prefix}.socialChallenges.${challenge?.id}`;
  if(!challenge?.id||ids.has(challenge.id)||!strings(challenge.targets)||!challenge.targets.length||!challenge.reason||!challenge.blockedReply||!strings(challenge.retryOn))errors.push(`${path} needs a unique ID, targets, stakes, blocked reply and declared retry evidence paths.`);
  ids.add(challenge?.id);requirements(challenge?.requires,path);
  if(!challenge?.approaches||!Object.keys(challenge.approaches).length||Object.entries(challenge.approaches).some(([skill,method])=>!skills.includes(skill)||!Number.isInteger(method?.dc)||method.dc<5||method.dc>25))errors.push(`${path} needs supported approaches and DC 5–25.`);
  for(const branch of ['success','failure','boundary']){
   const outcome=challenge?.[branch];
   if(typeof outcome?.reply!=='string'||!outcome.reply.trim())errors.push(`${path}.${branch} needs an authored outcome reply.`);
   for(const [axis,delta] of Object.entries(outcome?.relationship || {}))if(!['trust','respect','fear'].includes(axis)||!Number.isInteger(delta)||Math.abs(delta)>2)errors.push(`${path} has an invalid relationship delta.`);
   if(outcome?.effects!==undefined&&!Array.isArray(outcome.effects))errors.push(`${path} effects must be an array.`);
   for(const effect of (Array.isArray(outcome?.effects)?outcome.effects:[]))if(!effect||!['set','add'].includes(effect.op)||! /^(flags|knowledge)\.[a-zA-Z0-9_-]+$/.test(effect.path)||effect.path.startsWith('flags.')&&!Object.hasOwn(definition.initialFlags || {},effect.path.slice(6)))errors.push(`${path} may change only declared flags or knowledge, never locations, items or arbitrary state.`);
  }
  if(challenge?.evidence!==undefined&&!Array.isArray(challenge.evidence))errors.push(`${path} evidence must be an array.`);
  for(const evidence of (Array.isArray(challenge?.evidence)?challenge.evidence:[])){requirements(evidence?.requires,path);if(!evidence?.requires?.length)errors.push(`${path} evidence must have nonempty prerequisites.`);}
  for(const path of (Array.isArray(challenge?.retryOn)?challenge.retryOn:[]))if(! /^(flags|knowledge)\.[a-zA-Z0-9_-]+$/.test(path))errors.push(`${prefix} retry evidence must use declared fact paths.`);
 }
 return errors;
}
