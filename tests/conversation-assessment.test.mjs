import test from 'node:test';
import assert from 'node:assert/strict';
import roads from '../server/adventures/eldervale-roads.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import {projectNpc,projectScene} from '../server/scene-projection.mjs';
import {conversationCatalogue} from '../server/npc-conversation-planner.mjs';
import {assessNpcInput,validInputAssessment,conversationUnavailable} from '../server/npc-conversation-tools.mjs';
import {naturalNpcReply} from '../server/npc-natural-dialogue.mjs';
import {createDatabase,createPlayer,getParty,selectAdventure,setPartyState,getPartyState,getPlayer,listVisibleEvents} from '../server/database.mjs';
import {resolveAction} from '../server/dm.mjs';
const id='city-delvers-memorial-resident',npc=roads.story.npcs[id];
const at=()=>createCanonicalState(roads,{currentLocation:'city-delvers-memorial'});
const verdict={grounded:true,relevant:true,inCharacter:true,noConsequences:true};
const accept=(ids=[],text='Supported statement.')=>({decision:'accept',feedback:'',claims:ids.length?[{text,evidenceIds:ids}]:[],lookupIds:[]});
const plan=ids=>({goals:[{kind:'chat',evidenceIds:ids}],challengeId:'',approach:''});
function fixture(location='city-delvers-memorial'){const db=createDatabase(':memory:'),player=createPlayer(db,{partyId:'party-first-company',name:'Nigel',species:'Human',className:'Fighter'});selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');setPartyState(db,player.partyId,'world:eldervale-roads',createCanonicalState(roads,{currentLocation:location}));return {db,player,say:(text,npcGenerate)=>resolveAction(db,getPlayer(db,player.id),'speak',text,{npcGenerate,npcDialogueMode:'legacy'}),last:()=>listVisibleEvents(db,player).at(-1),state:()=>getPartyState(db,player.partyId,'world:eldervale-roads')};}

test('exact room question and apology use scene knowledge then zero-lookup social acknowledgement',async()=>{
 const f=fixture();try{
  const before=f.state(),first=[];
  await f.say("hi nima, could you tell me something about the room we're in?",async request=>{
   first.push(request);if(request.kind==='npc-conversation-input')return {tool:'read_knowledge',reply:''};
   if(request.kind==='npc-conversation-interpretation')return plan(['scene-current']);
   if(request.kind==='npc-natural-performance')return {reply:'This is the Returners’ Wall, a place for crews to leave promises and remember their returns.',evidenceIds:['scene-current']};return accept(['scene-current']);
  });
  assert.equal(f.last().speaker,'Nima Dawnstone');assert.deepEqual(first.map(call=>call.kind),['npc-conversation-input','npc-natural-performance','npc-claim-review']);
  const calls=[];
  await f.say("sorry didn't mean to upset you. just trying to make conversation",async request=>{
   calls.push(request);const input=JSON.parse(request.messages[1].content);
   assert.ok(input.history.some(turn=>turn.reply.includes('Returners’ Wall')));
   if(request.kind==='npc-conversation-input'){
    assert.equal(input.knowledge,undefined);assert.doesNotMatch(JSON.stringify(input.tools),/\b(food|Maren|quests?)\b/);
    return {tool:'respond_social',reply:'No need to apologise. We can simply talk; you have not done anything wrong.'};
   }
   assert.equal(request.kind,'npc-claim-review');assert.deepEqual(input.evidence,[]);return accept();
  });
  assert.match(f.last().text,/No need to apologise/);assert.doesNotMatch(f.last().text,/Last Lantern|Kitchens|Bakery|upset|angry/);
  assert.deepEqual(calls.map(call=>call.kind),['npc-conversation-input','npc-claim-review']);
  assert.deepEqual(f.state(),before);assert.equal(getPartyState(f.db,f.player.partyId,'pendingCheck:'+f.player.id),null);
  const status=getPartyState(f.db,f.player.partyId,'npcDialogueStatus:eldervale-roads:'+f.player.id);assert.equal(status.inputTool,'respond_social');assert.equal(status.source,'ai-reviewed');
  const history=getPartyState(f.db,f.player.partyId,`npcNaturalHistory:eldervale-roads:${id}:${f.player.id}`);assert.deepEqual(history.at(-1).evidenceIds,[]);
 }finally{f.db.close();}
});

test('conversational repair, humour and companionship are not phrase-matched into factual topics',async()=>{
 for(const speech of ['I think that came out rather clumsily.','Only teasing; I meant no harm.','Could we just enjoy a quiet chat for a moment?']){
  const f=fixture();try{
   const calls=[];await f.say(speech,async request=>{calls.push(request.kind);return request.kind==='npc-conversation-input'?{tool:'respond_social',reply:'Of course. We can take our time.'}:accept();});
   assert.equal(f.last().text,'Of course. We can take our time.');assert.equal(calls.length,2);assert.ok(!calls.includes('npc-conversation-interpretation'));
  }finally{f.db.close();}
 }
});

test('incorrect incoming food selection cannot bypass outgoing relevance assessment through fallback',async()=>{
 const f=fixture();try{
  const calls=[];let reviews=0;
  await f.say("Sorry, I just wanted to talk.",async request=>{
   calls.push(request.kind);
   if(request.kind==='npc-conversation-input')return {tool:'read_knowledge',reply:''}; // Deliberately wrong AI judgement.
   if(request.kind==='npc-conversation-interpretation')return plan(['delvers-food']);
   if(request.kind==='npc-natural-performance')return {reply:'Try Hearthcrumb Bakery in Lantern Ward.',evidenceIds:['delvers-food']};
   if(request.kind==='npc-claim-review')return ++reviews===1?{decision:'revise',feedback:'Respond to the apology, not food.',claims:[],lookupIds:[]}:accept();
   assert.equal(request.kind,'npc-natural-repair');
   return {reply:'You are quite all right. We can just talk.',evidenceIds:[]};
  });
  assert.equal(reviews,2);assert.equal(calls.length,5);assert.equal(f.last().text,'You are quite all right. We can just talk.');
  assert.doesNotMatch(f.last().text,/Bakery|Lantern Ward/);
  const status=getPartyState(f.db,f.player.partyId,'npcDialogueStatus:eldervale-roads:'+f.player.id);assert.equal(status.repaired,true);
  assert.deepEqual(getPartyState(f.db,f.player.partyId,`npcNaturalHistory:eldervale-roads:${id}:${f.player.id}`).at(-1).evidenceIds,[]);
 }finally{f.db.close();}
});

test('invalid first draft gets one AI repair and independent assessment, never raw selected text',async()=>{
 const calls=[],packet={npc:{name:'Someone'},personality:{},newestSpeech:'Just chatting.',history:[],evidence:[{id:'food',text:'A bakery exists.',tier:'everyday'}],allowUncitedSocial:true};
 const result=await naturalNpcReply({packet,fallback:'UNREVIEWED FOOD FALLBACK',assessed:true,generate:async request=>{
  calls.push(request.kind);if(request.kind==='npc-natural-performance')return {reply:'You now have bread.',evidenceIds:['food']};
  return request.kind==='npc-natural-repair'?{reply:'Of course. What is on your mind?',evidenceIds:[]}:verdict;
 }});
 assert.equal(result.reply,'Of course. What is on your mind?');assert.equal(result.repaired,true);
 assert.deepEqual(calls,['npc-natural-performance','npc-natural-repair','npc-natural-review']);
});

test('two rejected drafts produce a service notice, no NPC reply/history and no factual fallback leak',async()=>{
 const f=fixture();try{
  const calls=[],before=f.state();
  await f.say('Only making conversation.',async request=>{
   calls.push(request.kind);if(request.kind==='npc-conversation-input')return {tool:'respond_social',reply:'The hidden gate opens. You now have a key.'};
   return {reply:'You now have bread.',evidenceIds:[]};
  });
  assert.equal(f.last().speaker,'Dungeon Master');assert.equal(f.last().text,conversationUnavailable);
  assert.equal(getPartyState(f.db,f.player.partyId,`npcNaturalHistory:eldervale-roads:${id}:${f.player.id}`),null);
  assert.deepEqual(f.state(),before);assert.equal(calls.length,2);
 }finally{f.db.close();}
});

test('unavailable output assessor cannot approve a draft or publish an unchecked fallback',async()=>{
 const result=await naturalNpcReply({packet:{npc:{name:'Other'},evidence:[],newestSpeech:'hello'},assessed:true,fallback:'Food advice.',initialCandidate:{reply:'Hello there.',evidenceIds:[]},generate:async()=>{throw Error('offline');}});
 assert.equal(result.unavailable,true);assert.equal(result.reply,conversationUnavailable);assert.deepEqual(result.evidenceIds,[]);
});

test('MCP-inspired input tool contract rejects unknown capabilities, effects and invented tool parameters',async()=>{
 for(const value of [null,{tool:'write_world',reply:''},{tool:'respond_social',reply:'Hello',effects:[]},{tool:'read_knowledge',reply:'A secret.'},{tool:'clarify',reply:''},{tool:'read_knowledge',reply:'',arguments:{npc:'someone-else'}}])assert.ok(!validInputAssessment(value));
 assert.ok(validInputAssessment({tool:'respond_social',reply:'You are quite all right.'}));
 const result=await assessNpcInput({npc:{name:'Other',role:'Clerk'},history:[],speech:'I meant well.',generate:async()=>({tool:'respond_social',reply:'No harm done.'})});assert.equal(result.source,'ai');
});

test('knowledge tool exposes only the current projected scene, not unseen destinations or raw defaults',()=>{
 const state=at(),projection=projectNpc(npc,state);projection.scene=projectScene(roads,state);
 const scene=conversationCatalogue(npc,projection,state).entries.find(entry=>entry.id==='scene-current');
 assert.match(scene.text,/Returners|Wall/);assert.doesNotMatch(scene.text,/Citadel Threshold|private annotations|world\.flags/);
});

test('independent input assessment may refuse a spurious check proposed by the knowledge planner',async()=>{
 const f=fixture('city-delvers-maps');try{
  const before=f.state();
  await f.say('What are working notes?',async request=>request.kind==='npc-conversation-input'?{tool:'read_knowledge',reply:''}:request.kind==='npc-conversation-interpretation'?{goals:[{kind:'social-check',evidenceIds:[]}],challengeId:'lethriel-annotations',approach:'Persuasion'}:request.kind==='npc-natural-performance'?{reply:'What would you like to know about them?',evidenceIds:[]}:accept());
  assert.equal(getPartyState(f.db,f.player.partyId,'pendingCheck:'+f.player.id),null);assert.equal(f.last().speaker,'Lethriel Mossink');assert.deepEqual(f.state(),before);
 }finally{f.db.close();}
});
