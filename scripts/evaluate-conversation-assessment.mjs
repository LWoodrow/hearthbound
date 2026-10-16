// Opt-in live inference; gameplay database is memory-only. Read existing model
// settings from cwd, never load/switch a model or mutate the user's real save.
import {createDatabase,createPlayer,getParty,selectAdventure,setPartyState,getPartyState,getPlayer,listVisibleEvents} from '../server/database.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import roads from '../server/adventures/eldervale-roads.mjs';
import {resolveAction} from '../server/dm.mjs';
import {currentModelProfile} from '../server/model-runtime.mjs';
import {generateStructured} from '../server/ai-transport.mjs';
import {buildPromptPacket} from '../server/prompt-packets.mjs';
if(!process.argv.includes('--live'))throw Error('Use --live to run read-only inference with a memory-only test save.');
const profile=currentModelProfile(),faulty=process.argv.includes('--faulty-lookup'),db=createDatabase(':memory:');
console.log(JSON.stringify({model:profile.displayName,scenario:faulty?'deliberately-wrong-food-lookup':'actual-apology'}));
try{
 const player=createPlayer(db,{partyId:'party-first-company',name:'Nigel',species:'Human',className:'Fighter'}),id='city-delvers-memorial-resident';
 selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');
 const world=createCanonicalState(roads,{currentLocation:'city-delvers-memorial'});setPartyState(db,player.partyId,'world:eldervale-roads',world);
 setPartyState(db,player.partyId,`npcNaturalHistory:eldervale-roads:${id}:${player.id}`,[{speech:"hi nima, could you tell me something about the room we're in?",reply:'This is the Returners’ Wall. Folk stop here before a descent and after a return—it is a place to remember crews, not to pry into private grief.',evidenceIds:['city-delvers-memorial-resident-public-1']}]);
 const started=Date.now();
 await resolveAction(db,getPlayer(db,player.id),'speak',"sorry didn't mean to upset you. just trying to make conversation",{npcGenerate:async request=>{
  if(faulty){
   if(request.kind==='npc-conversation-input')return {tool:'read_knowledge',reply:''};
   if(request.kind==='npc-conversation-interpretation')return {goals:[{kind:'advice',evidenceIds:['delvers-food']}],challengeId:'',approach:''};
   if(request.kind==='npc-natural-performance')return {reply:'Try the Last Lantern or Hearthcrumb Bakery for something to eat.',evidenceIds:['delvers-food']};
  }
  const began=Date.now();console.log(JSON.stringify({phase:request.kind,status:'started'}));
  const packet=buildPromptPacket({kind:request.kind,profile,responseTokens:request.generation.numPredict,sections:request.messages.map((message,index)=>({...message,id:'assessment-'+index,required:true,visibility:'private'}))});
  if(packet.overBudget)throw Error('Prompt exceeds the configured context budget.');
  const output=await generateStructured(profile,packet.messages,request.schema,request.generation);
  console.log(JSON.stringify({phase:request.kind,status:'completed',elapsedMs:Date.now()-began,...(['npc-conversation-input','npc-natural-review'].includes(request.kind)?{assessment:output}:{})}));return output;
 }});
 const event=listVisibleEvents(db,player).at(-1),status=getPartyState(db,player.partyId,'npcDialogueStatus:eldervale-roads:'+player.id);
 console.log(JSON.stringify({speaker:event.speaker,reply:event.text,status,elapsedMs:Date.now()-started,canonicalUnchanged:JSON.stringify(world)===JSON.stringify(getPartyState(db,player.partyId,'world:eldervale-roads'))}));
}finally{db.close();}
