// Explicit real-model evaluation using ONLY memory saves; cwd settings are
// read, never changed. Does not create a game server or write the real save.
import {createDatabase,createPlayer,getParty,selectAdventure,setPartyState,getPartyState,getPlayer,listVisibleEvents} from '../server/database.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import roads from '../server/adventures/eldervale-roads.mjs';
import {resolveAction} from '../server/dm.mjs';
import {currentModelProfile} from '../server/model-runtime.mjs';
import {generateStructured} from '../server/ai-transport.mjs';
import {buildPromptPacket} from '../server/prompt-packets.mjs';
if(!process.argv.includes('--live'))throw Error('Use --live for a memory-only configured-model test.');
const profile=currentModelProfile(),limit=Number(process.argv.find(value=>value.startsWith('--limit='))?.split('=')[1] || 99);
const scenarios={
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
};
const selected=process.argv.find(arg=>arg.startsWith('--scenario='))?.split('=')[1] || 'nima';
const scenario=scenarios[selected];if(!scenario)throw Error('Unknown scenario.');
console.log(JSON.stringify({model:profile.displayName,scenario:selected}));
const db=createDatabase(':memory:');const timings=[];
try{
 const player=createPlayer(db,{partyId:'party-first-company',name:'Nigel',species:'Human',className:'Fighter'});
 selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');
 setPartyState(db,player.partyId,'world:eldervale-roads',createCanonicalState(roads,{currentLocation:scenario.location}));
 for(const text of scenario.turns.slice(0,limit)){
  const before=getPartyState(db,player.partyId,'world:eldervale-roads'),start=Date.now();let calls=0;
  await resolveAction(db,getPlayer(db,player.id),'speak',text,{npcDialogueMode:'one-pass',npcGenerate:async request=>{
   calls++;const packet=buildPromptPacket({kind:request.kind,profile,responseTokens:request.generation.numPredict,sections:request.messages.map((message,index)=>({...message,id:'dialogue-'+index,visibility:'private',required:true}))});
   if(packet.overBudget)throw Error('Context budget exceeded.');
   return await generateStructured(profile,packet.messages,request.schema,request.generation);
  }});
  const elapsedMs=Date.now()-start;timings.push(elapsedMs);
  const event=listVisibleEvents(db,player).at(-1),status=getPartyState(db,player.partyId,'npcDialogueStatus:eldervale-roads:'+player.id),pending=getPartyState(db,player.partyId,'pendingCheck:'+player.id);
  console.log(JSON.stringify({text,speaker:event.speaker,reply:event.text,calls,elapsedMs,status,canonicalUnchanged:JSON.stringify(before)===JSON.stringify(getPartyState(db,player.partyId,'world:eldervale-roads')),pendingCheck:pending?{skill:pending.skill,dc:pending.dc}:null}));
 }
 const sorted=[...timings].sort((a,b)=>a-b);console.log(JSON.stringify({turns:timings.length,medianMs:sorted[Math.floor(sorted.length/2)],slowestMs:sorted.at(-1)}));
}finally{db.close();}
