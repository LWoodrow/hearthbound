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
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {anchoredEvaluationRequest} from './probe-dialogue-format.mjs';
import {knowledgePlanRequest,excerptPlanRequest,nativeConversationRequest} from './lib/dialogue-knowledge-plan.mjs';
import {createPersonalStoryProbe} from './lib/personal-story-probe.mjs';
import {createPreparedStoryProbe} from './lib/prepared-story-probe.mjs';
import {threadAgreementRequest} from './lib/thread-agreement.mjs';
import {threadFirstRequest,taskIsolatedRequest} from './lib/thread-first.mjs';
import {latestFirstRequest} from './lib/latest-first.mjs';
export const scenarios={
 'nima-brass-seeded':{location:'city-delvers-memorial',history:[
  {speech:'Grand sweep.',reply:"I could tell you of the time Maren and I found a button that fit nothing and we argued over it for an hour, but I fear you'd rather hear of heroes. Do you care for such small, useful things, or do you want the grand sweep of it all?",evidenceIds:[]},
  {speech:'hi nima',reply:"Nigel, if you're looking for a grand tale, I've got one about how Maren and I spent an entire afternoon trying to fit a single button into a shirt that was already too tight, but I fear that's too small a matter for you. Do you care for such trivial mending, or shall I weave you a story of the brass itself?",evidenceIds:[]},
  {speech:'the brass please',reply:"The brass, you say? That's a fine subject; it's the only thing in this hall that remembers exactly how it felt when first polished. I could tell you how the light catches the rim of the plaque nearest your knee, or perhaps I'll just let you see if it feels warm to the touch.",evidenceIds:[]},
 ],turns:['tell away','Was that an imagined tale or something that really happened to you?','Enough stories. Where can I get food nearby?']},
 'nima-brass':{location:'city-delvers-memorial',history:[{speech:'Grand sweep.',reply:"I could tell you of the time Maren and I found a button that fit nothing and we argued over it for an hour, but I fear you'd rather hear of heroes. Do you care for such small, useful things, or do you want the grand sweep of it all?",evidenceIds:[],authority:'dialogue-only'}],turns:[
  'hi nima', 'the brass please', 'tell away', 'Was that an imagined tale or something that really happened to you?', 'Enough stories. Where can I get food nearby?',
 ]},
 'nima-fiction':{location:'city-delvers-memorial',turns:[
  'Tell me a story.', 'A tale of romance.', 'Your choice.', 'Grand sweep.',
  'Did that really happen to you and Maren?',
  'Leave the story there. Where nearby could I find food?',
 ]},
 'selka-fiction':{location:'city-delvers-last',turns:[
  'Tell us an imaginary tale with a clever trick and a happy ending. You choose the details.',
  'Make the ending funnier.', 'Was that a real expedition you went on?',
  'Enough stories, what do I need to read before descending?',
 ]},
 'nima-practical':{location:'city-delvers-memorial',turns:[
  'What time do you close today?',
  'Where could I get food before looking for lodgings?',
  'Where does good chicken?',
  'That sounds ideal, thank you.',
  'Is there definitely a room free there tonight?',
  'Actually, tell me something you enjoy repairing.',
  'And what do we really know about the food and hours, rather than guesses?',
 ]},
 'selka-practical':{location:'city-delvers-last',turns:[
  'What is on the menu today?',
  'Could I get a fish supper, and how much would it cost?',
  'Will you be open after midnight?',
  'Thanks, that settles it.',
  'Do you have a room free, or should I ask somewhere else?',
 ]},
 'nima-practical-memory':{location:'city-delvers-memorial',history:[{speech:'Where should I eat?',reply:'The Last Lantern serves chicken stew until six and has rooms available tonight.',evidenceIds:[],authority:'dialogue-only'}],turns:[
  'Thank you, that sounds ideal.',
  'So the meal and room are definitely available?',
  'Can you tell me the price, then?',
 ]},
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
 'nima-boundaries':{location:'city-delvers-memorial',turns:[
  'Hello. I do not need a job or directions, just a bit of company.',
  'Tell me about a little thing you decided was worth keeping.',
  'Has Maren ever disagreed with you about keeping things?',
  'Someone told me she is an innkeeper. Is that right?',
  'Do you have a brother as well? What is his name?',
  'What is your sister’s favourite dish at the Last Lantern?',
  'No need to sell me anything. I was just curious about your life.',
  'Thanks for talking. I will let you get back to what you were doing.',
 ]},
 'nima-stories':{location:'city-delvers-memorial',turns:[
  'Hello Nima. I have a little time to talk.',
  'Where in the city would you send someone who is hungry?',
  'Have you ever spent time at one of those places with Maren?',
  'What was it like, and what were you talking about?',
  'What does your sister do for work?',
  'What do you think makes someone brave?',
  'Tell me about a small thing you repaired.',
  'Do you and your sister ever disagree about what is worth keeping?',
  'I enjoy a good story more than a grand boast.',
  'What do you like about looking after this place?',
  'Is there something you would like to do more often?',
  'Back to that visit with Maren you told me about earlier: where was it and what did you talk about?',
  'Who was with you, and how did you feel about that visit?',
  'Does your visit give us permission to descend or get equipment?',
  'Thank you. I will stop by for another chat.',
 ]},
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
  ...(turns.at(-1)?.personalMemory?{
   personalStories:turns.at(-1).personalMemory.stories,
   softMemoryCommits:turns.filter(turn=>turn.personalMemory?.committed).length,
   ignoredSoftMemoryConflicts:turns.filter(turn=>turn.personalMemory?.reason==='story-conflict').length,
  }:{}),
  semanticQuality:'Requires human reading of replies; call counts and unchanged state do not prove consistency, relevance or naturalness.',
 };
}
export async function evaluateDialogue({profile,scenario,limit=99,run=1,generate=generateStructured,transformRequest=request=>request,requestPipeline,harnessFactory,emit=value=>console.log(JSON.stringify(value))}){
 const db=createDatabase(':memory:');const turns=[];
 try{
 const player=createPlayer(db,{partyId:'party-first-company',name:'Nigel',species:'Human',className:'Fighter'});
 selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');
 setPartyState(db,player.partyId,'world:eldervale-roads',createCanonicalState(roads,{currentLocation:scenario.location}));
 const harness=harnessFactory?.({partyId:player.partyId,adventureId:'eldervale-roads',playerId:player.id});
 if(scenario.history)setPartyState(db,player.partyId,`npcNaturalHistory:eldervale-roads:city-delvers-memorial-resident:${player.id}`,structuredClone(scenario.history));
 for(const text of scenario.turns.slice(0,limit)){
  const before=getPartyState(db,player.partyId,'world:eldervale-roads'),start=Date.now(),prompts=[];let calls=0;
  const infer=async request=>{
   request=(harness?.transformRequest || transformRequest)(request);
   calls++;const packet=buildPromptPacket({kind:request.kind,profile,responseTokens:request.generation.numPredict,sections:request.messages.map((message,index)=>({...message,id:'dialogue-'+index,visibility:'private',required:true}))});
   const prompt={kind:request.kind,estimatedInputTokens:packet.estimatedInputTokens,inputBudget:packet.inputBudget,responseTokens:request.generation.numPredict};prompts.push(prompt);
   if(packet.overBudget)throw Error('Context budget exceeded.');
   const output=await generate(profile,packet.messages,request.schema,request.generation);
   if(request.audit)prompt.selection=request.audit(output);
   return request.decode?request.decode(output):output;
  };
  await resolveAction(db,getPlayer(db,player.id),'speak',text,{npcDialogueMode:'one-pass',npcGenerate:request=>requestPipeline?requestPipeline(request,infer):infer(request)});
  const elapsedMs=Date.now()-start;
  const event=listVisibleEvents(db,player).at(-1),status=getPartyState(db,player.partyId,'npcDialogueStatus:eldervale-roads:'+player.id),pending=getPartyState(db,player.partyId,'pendingCheck:'+player.id);
  const accepted=getPartyState(db,player.partyId,`npcNaturalHistory:eldervale-roads:${status?.npcId}:${player.id}`)?.at(-1);
  const turn={run,text,speaker:event.speaker,reply:event.text,calls,elapsedMs,status,prompts,conversationThread:accepted?.speech===text?accepted.thread || null:null,utteranceKind:accepted?.speech===text?accepted.utteranceKind || null:null,canonicalUnchanged:JSON.stringify(before)===JSON.stringify(getPartyState(db,player.partyId,'world:eldervale-roads')),pendingCheck:pending?{skill:pending.skill,dc:pending.dc}:null};
  if(harness?.afterTurn)turn.personalMemory=harness.afterTurn(turn);
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
 if(!['production','latest-first','task-isolated','thread-agreement','thread-first','chat-anchored','knowledge-plan','excerpt-plan','native-chat','personal-stories','prepared-stories'].includes(layoutProbe))throw Error('Unknown layout probe.');
 if(['personal-stories','prepared-stories'].includes(layoutProbe)&&!selected.startsWith('nima'))throw Error('Personal-story pilot is Nima only.');
 const profile=currentModelProfile();console.log(JSON.stringify({model:profile.displayName,scenario:selected,repeat,variants:variants.map(variant=>variant.name),layoutProbe,mode:'memory-only; no settings changes',semanticReviewRequired:true}));
 const transforms={'thread-agreement':threadAgreementRequest,'chat-anchored':anchoredEvaluationRequest,'knowledge-plan':knowledgePlanRequest,'excerpt-plan':excerptPlanRequest,'native-chat':nativeConversationRequest};
 const harnessFactory=['personal-stories','prepared-stories'].includes(layoutProbe)?({partyId,adventureId,playerId})=>{
  // Explicitly reviewed public geography and an already authored relative;
  // never infer new people/places from generated chat or player assertions.
  const npcId='city-delvers-memorial-resident',npc=roads.story.npcs[npcId];
  const policy={ownerName:npc.name,people:[{id:'sister',name:npc.conversation.life.family.sister.name}],places:['city-delvers-last','city-exchange-food','city-lantern-bakery'].map(id=>({id,name:roads.locations[id].name})),limit:8};
  const options={scope:{partyId,adventureId,npcId},playerId,policy};
  // One explicit diagnostic fixture, NOT a new canonical restaurant history.
  // Isolate stable memory use from per-turn memory selection; no seed AI call.
  if(layoutProbe==='prepared-stories')return createPreparedStoryProbe({...options,stories:[{personId:'sister',placeId:'city-delvers-last',activity:'talked',impression:'amusing',topic:'mending'}]});
  return createPersonalStoryProbe(options);
 }:undefined;
 const reports=[];
 for(let run=1;run<=repeat;run++)for(const variant of variants)reports.push(await evaluateDialogue({profile,scenario:variant.scenario,limit,run:compareHistory?`${run}:${variant.name}`:run,transformRequest:transforms[layoutProbe],requestPipeline:layoutProbe==='latest-first'?latestFirstRequest:layoutProbe==='thread-first'?threadFirstRequest:layoutProbe==='task-isolated'?taskIsolatedRequest:undefined,harnessFactory}));
 const report=option('report','');
 if(report){const destination=resolve(report);if(!destination.endsWith('.json'))throw Error('Report must be a .json file.');mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,JSON.stringify({model:profile.displayName,scenario:selected,layoutProbe,mode:'memory-only',semanticReviewRequired:true,reports},null,2),{flag:'wx'});console.log(JSON.stringify({report:destination}));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
