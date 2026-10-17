// Low-stakes personal fiction is NOT canonical world/event state. This ledger
// has no database, interaction-engine, inventory or quest-writing capability.
const activities=['talked','walked','watched-the-street'];
const impressions=['pleasant','amusing','awkward'];
const topics=['mending','everyday-life','the-city'];
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const fail=(message,reason='invalid-output')=>{throw Object.assign(new Error(message),{code:'invalid-output',reason});};
const string=value=>typeof value==='string'&&!!value.trim()&&value.length<=150;
const scopeKey=scope=>{
 if(!exact(scope,['partyId','adventureId','npcId'])||!Object.values(scope).every(string))fail('Invalid personal-story scope.');
 return JSON.stringify([scope.partyId,scope.adventureId,scope.npcId]);
};
function validatePolicy(policy){
 if(!exact(policy,['ownerName','people','places','limit'])||!string(policy.ownerName)||!Number.isInteger(policy.limit)||policy.limit<1||policy.limit>12||!Array.isArray(policy.people)||policy.people.length>12||!Array.isArray(policy.places)||!policy.places.length||policy.places.length>12)fail('Invalid personal-story policy.');
 for(const rows of [policy.people,policy.places]){
  if(rows.some(row=>!exact(row,['id','name'])||!string(row.id)||!string(row.name))||new Set(rows.map(row=>row.id)).size!==rows.length)fail('Invalid personal-story references.');
 }
 return structuredClone(policy);
}
function canonicalProposal(policy,proposal){
 if(!exact(proposal,['personId','placeId','activity','impression','topic'])||!policy.people.some(person=>person.id===proposal.personId)||!policy.places.some(place=>place.id===proposal.placeId)||!activities.includes(proposal.activity)||!impressions.includes(proposal.impression)||!topics.includes(proposal.topic))fail('Invalid personal-story proposal.');
 return structuredClone(proposal);
}
const pairKey=story=>JSON.stringify([story.personId,story.placeId]);
const sameStory=(a,b)=>['personId','placeId','activity','impression','topic'].every(key=>a[key]===b[key]);

export function createPersonalStoryLedger(){
 const entries=new Map();
 const get=(scope,policy)=>{
  const key=scopeKey(scope),safePolicy=validatePolicy(policy),entry=entries.get(key);
  if(entry&&JSON.stringify(entry.policy)!==JSON.stringify(safePolicy))fail('Personal-story policy changed; explicit migration required.');
  return {key,policy:safePolicy,stories:entry?.stories || []};
 };
 const preview=(scope,policy,proposal)=>{
  const state=get(scope,policy),safe=canonicalProposal(state.policy,proposal),old=state.stories.find(story=>pairKey(story)===pairKey(safe));
  if(old&&!sameStory(old,safe))fail('Existing personal story cannot be overwritten.','story-conflict');
  if(!old&&state.stories.length>=state.policy.limit)fail('Personal-story memory is full.','story-capacity');
  return Object.freeze({id:old?.id || 's'+(state.stories.length+1),...safe,era:'before-this-adventure',provenance:'improvised-personal',verified:false});
 };
 return {
  preview,
  commit(scope,policy,proposal,playerId){
   if(!string(playerId))fail('Invalid personal-story audience.');
   const checked=preview(scope,policy,proposal),state=get(scope,policy);
   if(!entries.has(state.key)&&entries.size>=100)fail('Personal-story scope limit reached.');
   const stories=structuredClone(state.stories),old=stories.find(story=>story.id===checked.id);
   if(old){if(!old.heardBy.includes(playerId)){if(old.heardBy.length>=100)fail('Personal-story audience limit reached.');old.heardBy.push(playerId);}}
   else stories.push({...checked,heardBy:[playerId]});
   entries.set(state.key,{scope:structuredClone(scope),policy:state.policy,stories});
   return {...checked};
  },
  recall(scope,policy,id,playerId){
   const state=get(scope,policy),story=state.stories.find(story=>story.id===id);
   if(!story)fail('Unknown personal-story ID.');
   return this.commit(scope,policy,canonicalProposal(state.policy,storyProposal(story)),playerId);
  },
  view(scope,policy,playerId){
   if(!string(playerId))fail('Invalid personal-story audience.');
   const state=get(scope,policy);
   return state.stories.map(story=>({id:story.id,owner:state.policy.ownerName,
    companion:state.policy.people.find(person=>person.id===story.personId).name,
    place:state.policy.places.find(place=>place.id===story.placeId).name,
    activity:story.activity,impression:story.impression,topic:story.topic,era:story.era,provenance:story.provenance,verified:false,
    toldToThisPlayer:story.heardBy.includes(playerId),
   }));
  },
  snapshot(){return structuredClone([...entries.values()]);},
  restore(snapshot){
   if(!Array.isArray(snapshot)||snapshot.length>100)fail('Invalid personal-story snapshot.');
   // Validate into a temporary ledger; never partially replace old memory.
   const candidate=createPersonalStoryLedger(),seen=new Set();
   for(const entry of snapshot){
    if(!exact(entry,['scope','policy','stories'])||!Array.isArray(entry.stories))fail('Invalid personal-story snapshot entry.');
    const key=scopeKey(entry.scope);if(seen.has(key))fail('Duplicate personal-story scope.');seen.add(key);
    validatePolicy(entry.policy);
    for(const [index,story] of entry.stories.entries()){
     if(!exact(story,['id','personId','placeId','activity','impression','topic','era','provenance','verified','heardBy'])||story.id!=='s'+(index+1)||story.era!=='before-this-adventure'||story.provenance!=='improvised-personal'||story.verified!==false||!Array.isArray(story.heardBy)||!story.heardBy.length||story.heardBy.length>100||!story.heardBy.every(string)||new Set(story.heardBy).size!==story.heardBy.length)fail('Invalid personal-story snapshot record.');
     for(const player of story.heardBy)if(candidate.commit(entry.scope,entry.policy,storyProposal(story),player).id!==story.id)fail('Duplicate personal-story identity.');
    }
   }
   entries.clear();for(const entry of candidate.snapshot())entries.set(scopeKey(entry.scope),entry);
  },
 };
}
export function storyProposal(story){return Object.fromEntries(['personId','placeId','activity','impression','topic'].map(key=>[key,story[key]]));}
export const personalStoryOptions=Object.freeze({activities:Object.freeze(activities),impressions:Object.freeze(impressions),topics:Object.freeze(topics)});
