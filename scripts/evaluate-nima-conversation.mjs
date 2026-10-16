// Opt-in read-only model evaluation. Run from the configured app checkout so
// settings resolve normally; no database, gameplay, model-loading or settings writes.
import roads from '../server/adventures/eldervale-roads.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import {projectNpc} from '../server/scene-projection.mjs';
import {conversationEvidence,naturalConversationFallback,npcPersonality,npcRelationship} from '../server/npc-social-engine.mjs';
import {naturalNpcReply} from '../server/npc-natural-dialogue.mjs';
import {currentModelProfile} from '../server/model-runtime.mjs';
import {generateStructured} from '../server/ai-transport.mjs';
import {interpretNpcConversation,plannedConversationFallback} from '../server/npc-conversation-planner.mjs';
import {buildPromptPacket} from '../server/prompt-packets.mjs';
if(!process.argv.includes('--live'))throw Error('Use --live to request read-only inference from the configured model.');
const id='city-delvers-memorial-resident',npc=roads.story.npcs[id];
const world=createCanonicalState(roads,{currentLocation:'city-delvers-memorial'}),history=[],profile=currentModelProfile();
console.log(JSON.stringify({model:profile.displayName}));
const generate=async request=>{
 const phaseStarted=Date.now();
 console.log(JSON.stringify({phase:request.kind,status:'started'}));
 const packet=buildPromptPacket({kind:request.kind,profile,responseTokens:request.generation.numPredict,sections:request.messages.map((message,index)=>({...message,id:'evaluation-'+index,required:true,visibility:'private'}))});
 if(packet.overBudget)throw Error('Evaluation prompt exceeds the configured context budget.');
 try{const output=await generateStructured(profile,packet.messages,request.schema,request.generation);console.log(JSON.stringify({phase:request.kind,status:'completed',elapsedMs:Date.now()-phaseStarted,...(request.kind==='npc-conversation-interpretation'?{plan:output}:{})}));return output;}
 catch(error){console.log(JSON.stringify({phase:request.kind,status:'failed',elapsedMs:Date.now()-phaseStarted}));throw error;}
};
const limit=Number(process.argv.find(arg=>arg.startsWith('--limit='))?.split('=')[1] || 3);
for(const speech of ['Who helped make you the person standing here?','And what occupies her hands?','What occupies your hands here, and where should a weary traveller fill their stomach?'].slice(0,limit)){
 const started=Date.now();
 const personality=npcPersonality(npc,npcRelationship(world,id,'evaluation'));
 const interpreted=await interpretNpcConversation({npc,personality,projection:projectNpc(npc,world),world,speech,history,generate});
 const evidence=interpreted.source==='ai'?interpreted.evidence:conversationEvidence(npc,projectNpc(npc,world),world,speech,history);
 const fallback=interpreted.source==='ai'?plannedConversationFallback(interpreted.plan,evidence):naturalConversationFallback(npc,speech,evidence);
 const packet={npc:{name:npc.name,role:npc.role},personality,evidence,newestSpeech:speech,history:interpreted.history || history,conversationGoals:interpreted.plan?.goals};
 const result=await naturalNpcReply({packet,fallback,generate});
 console.log(JSON.stringify({speech,interpretation:interpreted.source,interpretationReason:interpreted.reason,goals:interpreted.plan?.goals,...result,elapsedMs:Date.now()-started}));
 history.push({speech,reply:result.reply,evidenceIds:result.evidenceIds || evidence.map(entry=>entry.id)});
}
