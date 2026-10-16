// Full live dialogue in a memory-only save. Existing settings are read from
// cwd; no real save/model/settings/port is changed.
import {createDatabase,createPlayer,getParty,selectAdventure,setPartyState,getPartyState,getPlayer,listVisibleEvents} from '../server/database.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import roads from '../server/adventures/eldervale-roads.mjs';
import {resolveAction} from '../server/dm.mjs';
import {currentModelProfile} from '../server/model-runtime.mjs';
import {generateStructured} from '../server/ai-transport.mjs';
import {buildPromptPacket} from '../server/prompt-packets.mjs';
import {compactNpcRequest} from '../server/npc-wire-format.mjs';
if(!process.argv.includes('--live'))throw Error('Use --live to request model inference with a memory-only test save.');
const profile=currentModelProfile(),db=createDatabase(':memory:'),limit=Number(process.argv.find(arg=>arg.startsWith('--limit='))?.split('=')[1] || 4);
const legacy=process.argv.includes('--legacy-history');
const subjectChange=process.argv.includes('--subject-change');
const transcript=legacy?["you taken your family or friends to any of them?"]:subjectChange?["sorry didn't mean to upset you. just trying to make conversation","hi nima, im kinda hungry, where in the city should i look for something good?"]:["hi nima, could you tell me something about the room we're in?","sorry didn't mean to upset you. just trying to make conversation","hi nima, im kinda hungry, where in the city should i look for something good?","you taken your family or friends to any of them?"];
console.log(JSON.stringify({model:profile.displayName,scenario:legacy?'recover-unverified-old-history':subjectChange?'apology-to-food-subject-change':'unseeded-full-user-exchange'}));
try{
 const player=createPlayer(db,{partyId:'party-first-company',name:'Nigel',species:'Human',className:'Fighter'});
 selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');
 const world=createCanonicalState(roads,{currentLocation:'city-delvers-memorial'});setPartyState(db,player.partyId,'world:eldervale-roads',world);
 if(legacy)setPartyState(db,player.partyId,`npcNaturalHistory:eldervale-roads:city-delvers-memorial-resident:${player.id}`,[
  {speech:'Sorry, only trying to make conversation.',reply:'Try the Last Lantern, Nine Kitchens Court or Hearthcrumb Bakery.',evidenceIds:['delvers-food']},
  {speech:'I am hungry, where should I look?',reply:'No upset at all. The Last Lantern is quiet and the stew holds. Or Nine Kitchens Court in the Grand Exchange, or Hearthcrumb Bakery in Lantern Ward.',evidenceIds:[]},
 ]);
 for(const speech of transcript.slice(0,limit)){
  const started=Date.now();console.log(JSON.stringify({speech,status:'started'}));
  await resolveAction(db,getPlayer(db,player.id),'speak',speech,{npcGenerate:async request=>{
   const began=Date.now();console.log(JSON.stringify({phase:request.kind,status:'started'}));
   const wire=compactNpcRequest(request);request=wire.request;
   const packet=buildPromptPacket({kind:request.kind,profile,responseTokens:request.generation.numPredict,sections:request.messages.map((message,index)=>({...message,id:'continuity-'+index,required:true,visibility:'private'}))});
   if(packet.overBudget)throw Error('Prompt exceeds current model context.');
   let output;try{output=wire.decode(await generateStructured(profile,packet.messages,request.schema,request.generation));}
   catch(error){console.log(JSON.stringify({phase:request.kind,status:'failed',elapsedMs:Date.now()-began,errorType:error.name,timeout:/timed out|timeout/i.test(error.message || '')}));throw error;}
   console.log(JSON.stringify({phase:request.kind,status:'completed',elapsedMs:Date.now()-began,...(['npc-conversation-input','npc-answer-plan','npc-claim-review'].includes(request.kind)?{assessment:output}:{})}));return output;
  }});
  const event=listVisibleEvents(db,player).at(-1),status=getPartyState(db,player.partyId,'npcDialogueStatus:eldervale-roads:'+player.id);
  console.log(JSON.stringify({speech,speaker:event.speaker,reply:event.text,status,elapsedMs:Date.now()-started,canonicalUnchanged:JSON.stringify(world)===JSON.stringify(getPartyState(db,player.partyId,'world:eldervale-roads'))}));
 }
}finally{db.close();}
