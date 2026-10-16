// Opt-in read-only model evaluation. Run from the configured app checkout so
// settings resolve normally; no database, gameplay, model-loading or settings writes.
import roads from '../server/adventures/eldervale-roads.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import {projectNpc} from '../server/scene-projection.mjs';
import {conversationEvidence,naturalConversationFallback,npcPersonality,npcRelationship} from '../server/npc-social-engine.mjs';
import {naturalNpcReply} from '../server/npc-natural-dialogue.mjs';
import {currentModelProfile} from '../server/model-runtime.mjs';
import {generateStructured} from '../server/ai-transport.mjs';
if(!process.argv.includes('--live'))throw Error('Use --live to request read-only inference from the configured model.');
const id='city-delvers-memorial-resident',npc=roads.story.npcs[id];
const world=createCanonicalState(roads,{currentLocation:'city-delvers-memorial'}),history=[],profile=currentModelProfile();
console.log(JSON.stringify({model:profile.displayName}));
for(const speech of ["Hi Nima, I can't decide whether it is hot or cold today.",'I am hungry. Anywhere in the city you recommend to eat?','Tell me about your family.','What does she do?']){
 const evidence=conversationEvidence(npc,projectNpc(npc,world),world,speech,history);
 const packet={npc:{name:npc.name,role:npc.role},personality:npcPersonality(npc,npcRelationship(world,id,'evaluation')),evidence,newestSpeech:speech,history};
 const started=Date.now();
 const result=await naturalNpcReply({packet,fallback:naturalConversationFallback(npc,speech,evidence),generate:request=>generateStructured(profile,request.messages,request.schema,request.generation)});
 console.log(JSON.stringify({speech,...result,elapsedMs:Date.now()-started}));
 history.push({speech,reply:result.reply,evidenceIds:result.evidenceIds || evidence.map(entry=>entry.id)});
}
