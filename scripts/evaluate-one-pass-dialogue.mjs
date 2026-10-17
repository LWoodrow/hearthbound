// Explicit real-model evaluation using ONLY memory saves; cwd settings are
// read, never changed. Does not create a game server or write the real save.
import {createDatabase,createPlayer,getParty,selectAdventure,setPartyState,getPartyState,getPlayer,listVisibleEvents} from '../server/database.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import roads from '../server/adventures/eldervale-roads.mjs';
import {resolveAction} from '../server/dm.mjs';
import {currentModelProfile} from '../server/model-runtime.mjs';
import {generateStructured} from '../server/ai-transport.mjs';
import {buildPromptPacket} from '../server/prompt-packets.mjs';
import {pathToFileURL} from 'node:url';
import {anchoredEvaluationRequest} from './probe-dialogue-format.mjs';
export const scenarios={
 nima:{location:'city-delvers-memorial',turns:[
  'hi nima',
  "I'm doing all right. How are you feeling?",
  "Sorry, didn't mean to make this solemn. Just making conversation.",
  "I'm a little hungry. Where in the city would you recommend?",
  'Have you taken your family or friends to any of those places?',
  'Fair enough. Tell me about your family instead.',
  'What does Maren do?',
  'Does she tease you much?',
  'You sound handy. What do you enjoy making?',
  'So between you two, nothing ever gets thrown away? I am joking.',
  'Back to being hungry: which of those places is nearest?',
  "I only want directions, not for you to fetch or buy me anything.",
  'Tell me something about this place that you like.',
  "We're planning to journey down after eating. What should I bear in mind?",
  "Thanks. I'll come back and tell you how it went.",
 ]},
 selka:{location:'city-delvers-last',turns:['Hello Selka! Is this a good place for a conversation?',"What makes you smile about your work?","I bet you've heard some terrible boasts.","Could I persuade you to share your own expedition story?"]},
 dorrik:{location:'city-delvers-board',turns:['Hello Dorrik. You look busy.',"You don't sound like a man who enjoys a long boast.","What do you enjoy about the work, then?",'Would you vouch for our crew? I would like to persuade you.']},
 lethriel:{location:'city-delvers-maps',turns:['Hello Lethriel.','Please give me exact directions to the Surveyors’ Refuge.','Could I convince you to let me read your unfinished working notes?']},
 'nima-everyday':{location:'city-delvers-memorial',turns:[
  'Hello. I am not after a job or directions, just a bit of company.',
  'What do you like doing when you can put work aside?',
  'Tell me about something you have actually made or repaired.',
  'Why leave the scratches? I would want everything to look new.',
  'I think you and your sister might disagree about what is worth keeping.',
  'Can you give me an example of that?',
  'Who was teasing whom about the brass, then?',
  'You have not told me what your sister does for work.',
  'Do you ever get anything wrong yourself?',
  'Forget the repairs for a moment. Where would you send a hungry traveller?',
  'Is that a personal recommendation from visiting, or just somewhere you know about?',
  'Thanks for the company. We can leave it there for now.',
 ]},
 'nima-memory':{location:'city-delvers-memorial',history:[{
  speech:'Tell me about your family and favourite place to eat.',
  reply:'Maren is my older brother. We visit the Copper Swan every night for his favourite silverberry pie.',
  evidenceIds:[],authority:'dialogue-only',
 }],turns:[
  'I thought Maren was your younger sister? Who is she?',
  'What does she do for work?',
  'And that restaurant visit you mentioned, do you actually know that happened?',
  'All right, what do you enjoy doing together?',
  'Tell me about a small disagreement you have had.',
  'I am hungry. What is the nearest place you can recommend?',
  'No need to arrange anything. Thank you.',
 ]},
};
export function summarizeDialogueRun(turns){
 const timings=turns.map(turn=>turn.elapsedMs).sort((a,b)=>a-b);
 return {
  turns:turns.length,
  medianMs:timings.length?timings[Math.floor(timings.length/2)]:null,
  slowestMs:timings.at(-1) ?? null,
  totalCalls:turns.reduce((total,turn)=>total+turn.calls,0),
  singleCallTurns:turns.filter(turn=>turn.calls===1).length,
  repairedTurns:turns.filter(turn=>turn.status?.repaired).length,
  unavailableTurns:turns.filter(turn=>turn.status?.unavailable).length,
  canonicalChanges:turns.filter(turn=>!turn.canonicalUnchanged).length,
  pendingChecks:turns.filter(turn=>turn.pendingCheck).length,
  largestEstimatedInputTokens:Math.max(0,...turns.flatMap(turn=>turn.prompts.map(prompt=>prompt.estimatedInputTokens))),
  semanticQuality:'Requires human reading of replies; call counts and unchanged state do not prove consistency, relevance or naturalness.',
 };
}
export async function evaluateDialogue({profile,scenario,limit=99,run=1,generate=generateStructured,transformRequest=request=>request,emit=value=>console.log(JSON.stringify(value))}){
 const db=createDatabase(':memory:');const turns=[];
 try{
 const player=createPlayer(db,{partyId:'party-first-company',name:'Nigel',species:'Human',className:'Fighter'});
 selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');
 setPartyState(db,player.partyId,'world:eldervale-roads',createCanonicalState(roads,{currentLocation:scenario.location}));
 if(scenario.history)setPartyState(db,player.partyId,`npcNaturalHistory:eldervale-roads:city-delvers-memorial-resident:${player.id}`,structuredClone(scenario.history));
 for(const text of scenario.turns.slice(0,limit)){
  const before=getPartyState(db,player.partyId,'world:eldervale-roads'),start=Date.now(),prompts=[];let calls=0;
  await resolveAction(db,getPlayer(db,player.id),'speak',text,{npcDialogueMode:'one-pass',npcGenerate:async request=>{
   request=transformRequest(request);
   calls++;const packet=buildPromptPacket({kind:request.kind,profile,responseTokens:request.generation.numPredict,sections:request.messages.map((message,index)=>({...message,id:'dialogue-'+index,visibility:'private',required:true}))});
   prompts.push({kind:request.kind,estimatedInputTokens:packet.estimatedInputTokens,inputBudget:packet.inputBudget});
   if(packet.overBudget)throw Error('Context budget exceeded.');
   const output=await generate(profile,packet.messages,request.schema,request.generation);
   return request.decode?request.decode(output):output;
  }});
  const elapsedMs=Date.now()-start;
  const event=listVisibleEvents(db,player).at(-1),status=getPartyState(db,player.partyId,'npcDialogueStatus:eldervale-roads:'+player.id),pending=getPartyState(db,player.partyId,'pendingCheck:'+player.id);
  const turn={run,text,speaker:event.speaker,reply:event.text,calls,elapsedMs,status,prompts,canonicalUnchanged:JSON.stringify(before)===JSON.stringify(getPartyState(db,player.partyId,'world:eldervale-roads')),pendingCheck:pending?{skill:pending.skill,dc:pending.dc}:null};
  turns.push(turn);emit(turn);
 }
 const summary=summarizeDialogueRun(turns);emit({run,...summary});return {turns,summary};
 }finally{db.close();}
}
async function main(){
 if(!process.argv.includes('--live'))throw Error('Use --live for a memory-only configured-model test.');
 const option=(name,fallback)=>process.argv.find(arg=>arg.startsWith('--'+name+'='))?.split('=')[1] || fallback;
 const selected=option('scenario','nima'),scenario=scenarios[selected],limit=Number(option('limit',99)),repeat=Number(option('repeat',1));
 if(!scenario)throw Error('Unknown scenario. Choose: '+Object.keys(scenarios).join(', '));
 if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(repeat)||repeat<1||repeat>3)throw Error('Use limit=1..100 and repeat=1..3.');
 const compareHistory=process.argv.includes('--compare-history');
 if(compareHistory&&!scenario.history)throw Error('History comparison needs a seeded scenario such as nima-memory.');
 const variants=compareHistory?[{name:'clean',scenario:{...scenario,history:undefined}},{name:'seeded',scenario}]:[{name:'default',scenario}];
 const layoutProbe=option('layout-probe','production');
 if(!['production','chat-anchored'].includes(layoutProbe))throw Error('Unknown layout probe.');
 const profile=currentModelProfile();console.log(JSON.stringify({model:profile.displayName,scenario:selected,repeat,variants:variants.map(variant=>variant.name),layoutProbe,mode:'memory-only; no settings changes',semanticReviewRequired:true}));
 for(let run=1;run<=repeat;run++)for(const variant of variants)await evaluateDialogue({profile,scenario:variant.scenario,limit,run:compareHistory?`${run}:${variant.name}`:run,transformRequest:layoutProbe==='chat-anchored'?anchoredEvaluationRequest:undefined});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
