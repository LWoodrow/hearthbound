import {normaliseText,meaningfulReferenceWords,tokenEquivalent} from './semantic-tokens.mjs';
import {requirementsMet,npcLocations} from './world-state.mjs';
import {applyEffects} from './interaction-engine.mjs';
import {npcConversationTopic,everydayConversationIntent,factualNpcFallback} from './npc-dialogue.mjs';
import {recordCanonicalTransition} from './canonical-events.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
const clamp=value=>Math.max(-5,Math.min(5,Number(value)||0));
const read=(state,path)=>path.split('.').reduce((value,key)=>value?.[key],state);
export function npcRelationship(world,npcId,playerId) {
  const saved=world.social?.[npcId]?.[playerId] || {};
  return {trust:clamp(saved.trust),respect:clamp(saved.respect),fear:Math.max(0,clamp(saved.fear)),
    mood:saved.mood || '',episodes:(saved.episodes || []).slice(-12),attempts:saved.attempts || {}};
}
export function npcPersonality(npc,relationship) {
  const authored=npc.personality || {};
  return {traits:authored.traits || [],values:authored.values || [],interests:authored.interests || [],
    mannerisms:authored.mannerisms || [],boundaries:authored.boundaries || [],bonds:authored.bonds || [],
    mood:relationship.mood || authored.mood || 'attentive',voice:npc.voice || 'Plain and courteous',
    relationship:{trust:relationship.trust,respect:relationship.respect,fear:relationship.fear},episodes:relationship.episodes};
}

const solutionRequest=action=>/\b(?:solve|solution|bypass|avoid|operate|mechanism|align|wheel|gate|sentinel|puzzle)\b/i.test(action);
const detailRequest=action=>solutionRequest(action)||/\b(?:directions|exact route|which turn|how do (?:i|we) (?:reach|get)|how to (?:reach|get)|route to)\b/i.test(action);
export function conversationEvidence(npc,projection,world,action,memory=[]) {
  const tokens=meaningfulReferenceWords(action).filter(token=>!['what','would','good','tell','know','about','anything','please','could','happening','here','below','there','exploring'].includes(token));
  const intent=everydayConversationIntent(action);
  const kind=intent?null:npcConversationTopic(action),last=memory.at(-1);
  const broad=kind==='greeting'||kind==='local-news'||kind==='personal'||kind==='follow-up';
  const topics=(projection.topics || []).filter(topic=>topic.kind===(kind==='follow-up'?last?.topicKind:kind));
  const used=new Set(memory.map(entry=>entry.reply)),usedIds=new Set(memory.flatMap(entry=>entry.evidenceIds || []));
  const topic=topics.find(topic=>!used.has(topic.text)&&!usedIds.has(topic.id));
  const explicit=(npc.conversation?.knowledge || []).filter(entry=>requirementsMet(world,entry.requires || []));
  const source=explicit.length?explicit:projection.facts.map((text,index)=>({id:'legacy-'+index,text,tier:'advice',subjects:[]}));
  const refersBack=/\b(?:you said|you mentioned|what did you mean|why is that|why do you say|that map|those notes|more about that|tell me more|what else|go on|\b(?:she|he|they|her|him|their)\b)\b/i.test(action);
  const previousIds=new Set(refersBack&&!intent?memory.slice(-1).flatMap(entry=>entry.evidenceIds || []):[]);
  const knowledge=source.filter(entry=>entry.tier!=='solution'||solutionRequest(action)||previousIds.has(entry.id))
    .filter(entry=>entry.tier!=='detail'||detailRequest(action)||previousIds.has(entry.id))
    .filter(entry=>! /\b(?:playable|implemented|inventory|campaign levels?|combat bonus|mechanical rest|backend)\b/i.test(entry.text))
    .filter(entry=>!intent || (entry.subjects || []).includes('everyday:'+intent))
    .map(entry=>{const terms=meaningfulReferenceWords((entry.subjects || []).join(' ')+' '+entry.text);return {...entry,score:(intent?10:0)+(previousIds.has(entry.id)?10:0)+tokens.filter(token=>terms.some(term=>tokenEquivalent(token,term))).length};})
    .filter(entry=>(!broad||previousIds.has(entry.id))&&entry.score>0).sort((a,b)=>b.score-a.score).slice(0,2);
  return [...(topic?[{id:topic.id,text:topic.text,tier:'everyday'}]:[]),...knowledge].slice(0,3);
}

export function naturalConversationFallback(npc,action,evidence,topicReply) {
 const intent=everydayConversationIntent(action);
 if(intent==='transaction')return factualNpcFallback(npc,action,[]);
 if(evidence.length)return evidence.map(entry=>entry.text).join(' ');
 if(intent==='family')return '“I would rather leave my family out of this conversation for now. Was there something else you wanted to ask?”';
 if(intent==='weather')return '“I have not paid much attention to the weather. Are you finding it uncomfortable?”';
 if(intent==='wellbeing')return '“Thank you for asking. How are you getting on?”';
 return topicReply?.reply || factualNpcFallback(npc,action,[]);
}

function approachFor(action) {
 const words=normaliseText(action);
 if(/\b(?:threaten|intimidate|or else|hurt you|break your|kill you)\b/.test(words))return 'Intimidation';
 if(/\b(?:lie|deceive|pretend|bluff|falsely claim)\b/.test(words))return 'Deception';
 if(/\b(?:insight|read .*intentions|size .*up|read .*mood)\b/.test(words))return 'Insight';
 if(/\b(?:perform|entertain|sing|recite)\b/.test(words))return 'Performance';
 return 'Persuasion';
}
const fingerprint=(challenge,world)=>JSON.stringify((challenge.retryOn || []).map(path=>[path,read(world,path) ?? null]));
export function planSocialAttempt({npc,npcId,playerId,world,action,interpretation}) {
 const words=normaliseText(action);
 // Semantic interpretation proposes an existing goal/approach, never a DC or
 // effect. Existing phrase matching is exclusively the degraded-mode path.
 if(interpretation!==undefined){
  if(!interpretation.challengeId||!['Persuasion','Deception','Intimidation','Insight','Performance'].includes(interpretation.approach))return null;
 }else{
  if(!/\b(?:can|could|may|please|let|show|share|persuade|convince|lie|pretend|bluff|threaten|intimidate|insight|intentions|size|perform|entertain|sing|recite|want|like|see|tell)\b/.test(words))return null;
  if(/\b(?:what (?:are|is)|tell me about|explain)\b/.test(words)&&!/\b(?:share|show|let|persuade|convince|lie|threaten|intimidate|see|read)\b/.test(words))return null;
 }
 const matches=(npc.socialChallenges || []).filter(challenge=>interpretation?challenge.id===interpretation.challengeId:challenge.targets.some(target=>words.includes(normaliseText(target))));
 if(!matches.length)return null;
 if(matches.length>1)return {kind:'blocked',reply:'Which request did you mean? Please choose one thing to discuss.'};
 const challenge=matches[0],relationship=npcRelationship(world,npcId,playerId),signature=fingerprint(challenge,world);
 const previous=relationship.attempts[challenge.id];
 if(previous?.status==='success')return {kind:'blocked',reply:challenge.success.reply};
 if(previous?.signature===signature)return {kind:'blocked',reply:challenge.retryReply || 'Their answer has not changed. Bring something new to the discussion rather than repeating the request.'};
 if(!requirementsMet(world,challenge.requires || []))return {kind:'blocked',reply:challenge.blockedReply};
 const approach=interpretation?.approach || approachFor(action),method=challenge.approaches[approach];
 const base={challengeId:challenge.id,npcId,playerId,signature,locationId:world.currentLocation,approach};
 if(!method)return {kind:'automatic',...base,result:'boundary',reply:challenge.boundary.reply};
 const evidence=(challenge.evidence || []).find(entry=>requirementsMet(world,entry.requires));
 if(evidence)return {kind:'automatic',...base,result:'success',reply:evidence.reply || challenge.success.reply};
 const adjustment=approach==='Persuasion'?Math.max(-2,Math.min(2,-relationship.trust)):0;
 return {kind:'check',...base,ability:approach==='Insight'?'Wisdom':'Charisma',skill:approach,
  dc:Math.max(5,Math.min(25,method.dc+adjustment)),reason:challenge.reason};
}

export function resolveSocialAttempt({definition,world,playerId,pending,success}) {
 const npc=definition.story.npcs[pending.npcId],challenge=npc?.socialChallenges?.find(entry=>entry.id===pending.challengeId);
 if(!challenge||pending.playerId!==playerId||pending.locationId!==world.currentLocation||!npcLocations(npc,world).includes(world.currentLocation)
   ||fingerprint(challenge,world)!==pending.signature||!requirementsMet(world,challenge.requires || []))return {accepted:false,state:world,reply:'The situation has changed; speak to them again before attempting that request.'};
 const old=npcRelationship(world,pending.npcId,playerId);
 if(old.attempts[challenge.id]?.signature===pending.signature || old.attempts[challenge.id]?.status==='success')return {accepted:false,state:world,reply:'That attempt has already been resolved.'};
 const result=pending.result==='boundary'?'boundary':success?'success':'failure';
 const outcome=challenge[result],next=clone(world),delta=outcome.relationship || {};
 const relationship={...old,trust:clamp(old.trust+(delta.trust || 0)),respect:clamp(old.respect+(delta.respect || 0)),fear:Math.max(0,clamp(old.fear+(delta.fear || 0))),mood:outcome.mood || old.mood,
  episodes:[...old.episodes,{eventId:challenge.id,result,summary:outcome.memory || outcome.reply}].slice(-12),
  attempts:{...old.attempts,[challenge.id]:{signature:pending.signature,status:result}}};
 next.social ||= {};next.social[pending.npcId] ||= {};next.social[pending.npcId][playerId]=relationship;
 applyEffects(next,outcome.effects || []);
 next.revision=Number(world.revision || 0)+1;
 next.outcomes=[...(next.outcomes || []),{revision:next.revision,socialChallenge:challenge.id,playerId,result,publicFacts:[outcome.reply]}].slice(-100);
 const transition=recordCanonicalTransition(world,next);
 return {accepted:true,state:transition.state,canonicalEvents:transition.canonicalEvents,reply:outcome.reply,result};
}
