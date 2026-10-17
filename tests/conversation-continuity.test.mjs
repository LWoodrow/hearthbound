import test from 'node:test';
import assert from 'node:assert/strict';
import roads from '../server/adventures/eldervale-roads.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import {createDatabase,createPlayer,getParty,selectAdventure,setPartyState,getPartyState,getPlayer,listVisibleEvents} from '../server/database.mjs';
import {resolveAction} from '../server/dm.mjs';
import {naturalNpcReply} from '../server/npc-natural-dialogue.mjs';
import {validClaimReview} from '../server/npc-grounded-conversation.mjs';
import {conversationUnavailable} from '../server/npc-conversation-tools.mjs';
import {assessNpcInput} from '../server/npc-conversation-tools.mjs';
const accept=(claims=[])=>({decision:'accept',feedback:'',claims,lookupIds:[]});
const claim=(text,...evidenceIds)=>({text,evidenceIds});
const id='city-delvers-memorial-resident';
function fixture(){const db=createDatabase(':memory:'),player=createPlayer(db,{partyId:'party-first-company',name:'Nigel',species:'Human',className:'Fighter'});selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');const state=createCanonicalState(roads,{currentLocation:'city-delvers-memorial'});setPartyState(db,player.partyId,'world:eldervale-roads',state);return {db,player,state,say:(speech,npcGenerate)=>resolveAction(db,getPlayer(db,player.id),'speak',speech,{npcGenerate}),last:()=>listVisibleEvents(db,player).at(-1),history:()=>getPartyState(db,player.partyId,`npcNaturalHistory:eldervale-roads:${id}:${player.id}`),status:()=>getPartyState(db,player.partyId,'npcDialogueStatus:eldervale-roads:'+player.id)};}

test('whole user conversation retains current focus and repairs old emotional carry-over and unsupported dining facts',async()=>{
 const f=fixture();try{
  await f.say("hi nima, could you tell me something about the room we're in?",async request=>{
   if(request.kind==='npc-conversation-input')return {tool:'read_knowledge',focus:'Describe the current Returners’ Wall setting.',reply:''};
   if(request.kind==='npc-natural-performance')return {reply:'This is the Returners’ Wall, where people stop before and after descents.',evidenceIds:['city-delvers-memorial-resident-public-1']};
   return accept([claim('People stop at the Wall before and after descents.','city-delvers-memorial-resident-public-1')]);
  });
  await f.say("sorry didn't mean to upset you. just trying to make conversation",async request=>request.kind==='npc-conversation-input'?{tool:'respond_social',focus:'Acknowledge a friendly apology, without assuming offence.',reply:'No harm done. We can simply talk.'}:accept());
  assert.equal(f.last().text,'No harm done. We can simply talk.');
  let reviews=0;
  await f.say('hi nima, im kinda hungry, where in the city should i look for something good?',async request=>{
   const input=JSON.parse(request.messages[1].content);
   if(request.kind==='npc-conversation-input')return {tool:'read_knowledge',focus:'Recommend existing places to eat in the city; this is a new subject, not the earlier apology.',reply:''};
   assert.match(input.conversationFocus,/places to eat/);
   if(request.kind==='npc-natural-performance')return {reply:'No upset at all. The Last Lantern is quiet and the stew holds.',evidenceIds:['delvers-food']};
   if(request.kind==='npc-claim-review')return ++reviews===1?{decision:'revise',feedback:'Drop the old apology. Quiet ambience and stew quality are not established. Recommend the actual eating places.',claims:[claim('The Last Lantern is quiet and has good stew.')],lookupIds:[]}:accept([claim('Last Lantern is nearby in Delvers’ Quarter.','delvers-food'),claim('Nine Kitchens Court is in the Grand Exchange.','delvers-food'),claim('Hearthcrumb Bakery is in Lantern Ward.','delvers-food')]);
   assert.equal(request.kind,'npc-natural-repair');assert.match(input.reviewFeedback,/old apology/);
   return {reply:'Try the Last Lantern nearby, Nine Kitchens Court in the Grand Exchange, or Hearthcrumb Bakery in Lantern Ward.',evidenceIds:['delvers-food']};
  });
  assert.equal(reviews,2);assert.doesNotMatch(f.last().text,/upset|stew|quiet/);assert.equal(f.status().claimCount,3);
  const calls=[];let familyReviews=0;
  await f.say('you taken your family or friends to any of them?',async request=>{
   calls.push(request.kind);const input=JSON.parse(request.messages[1].content);
   if(request.kind==='npc-conversation-input'){
    assert.match(JSON.stringify(input.history.at(-1)),/Nine Kitchens/);
    return {tool:'respond_social',focus:'Has Nima taken family/friends to the Last Lantern, Nine Kitchens Court or Hearthcrumb Bakery?',reply:'Family and friends, yes; folk gather here before and after descents.'}; // Deliberately wrong route/draft.
   }
   assert.match(input.conversationFocus,/Nine Kitchens Court/);
   if(request.kind==='npc-claim-review'&&++familyReviews===1)return {decision:'lookup',feedback:'The question is about visiting those eating places with family, not gathering at the Wall. Retrieve family and food context. Do not invent personal visits.',claims:[claim('Nima has taken family/friends to those places.')],lookupIds:['nima-family','delvers-food']};
   if(request.kind==='npc-natural-repair'){
    assert.ok(input.evidence.some(entry=>entry.id==='nima-family'));assert.ok(input.evidence.some(entry=>entry.id==='delvers-food'));
    return {reply:'I cannot give you a first-hand family verdict on those places. What sort of meal are you hoping for?',evidenceIds:[]};
   }
   return accept();
  });
  assert.deepEqual(calls,['npc-conversation-input','npc-claim-review','npc-natural-repair','npc-claim-review']);
  assert.doesNotMatch(f.last().text,/gather here|before.*descents/);assert.equal(f.status().lookupCount,1);
  assert.equal(f.history().at(-1).review.audits[0].decision,'lookup');assert.equal(f.history().at(-1).focus.includes('Hearthcrumb'),true);
  assert.deepEqual(getPartyState(f.db,f.player.partyId,'world:eldervale-roads'),f.state);assert.equal(getPartyState(f.db,f.player.partyId,'pendingCheck:'+f.player.id),null);
 }finally{f.db.close();}
});

test('concrete claim receipts require current evidence even if the auditor says accept',()=>{
 const evidence=[{id:'food',text:'A bakery exists.',tier:'everyday'}];
 assert.equal(validClaimReview(accept([claim('The bakery has excellent stew.')]),evidence,evidence),false);
 assert.equal(validClaimReview(accept([claim('A bakery exists.','invented')]),evidence,evidence),false);
 assert.equal(validClaimReview(accept([claim('A bakery exists.','food')]),evidence,evidence),true);
 assert.equal(validClaimReview(accept(),[],evidence),true);
 for(const bad of [null,{}, {...accept(),effects:[]},{...accept(),lookupIds:['food']},{decision:'lookup',feedback:'Read the secret.',claims:[],lookupIds:['secret']},{decision:'lookup',feedback:'',claims:[],lookupIds:['food']}])assert.equal(validClaimReview(bad,evidence,evidence),false);
});

test('uncited factual social draft triggers AI knowledge lookup then independently verified correction',async()=>{
 const calls=[],packet={focusVersion:2,npc:{name:'Other'},personality:{},newestSpeech:'Where would you send me for supper?',conversationFocus:'Recommend a place to eat.',history:[],evidence:[]};
 const available=[{id:'supper',text:'The Green Inn is in the square.',subjects:['food','inn'],tier:'everyday'}];let reviews=0;
 const result=await naturalNpcReply({packet,assessed:true,availableKnowledge:available,initialCandidate:{reply:'The Green Inn has delicious soup.',evidenceIds:[]},generate:async request=>{
  calls.push(request.kind);const input=JSON.parse(request.messages[1].content);
  if(request.kind==='npc-claim-review')return ++reviews===1?{decision:'lookup',feedback:'Check the inn location; soup quality is not established.',claims:[claim('The Green Inn has delicious soup.')],lookupIds:['supper']}:accept([claim('The Green Inn is in the square.','supper')]);
  assert.equal(input.evidence[0].id,'supper');return {reply:'The Green Inn is in the square.',evidenceIds:['supper']};
 }});
 assert.equal(result.source,'ai-reviewed');assert.equal(result.lookupCount,1);assert.deepEqual(result.evidenceIds,['supper']);assert.doesNotMatch(result.reply,/soup/);
 assert.deepEqual(calls,['npc-claim-review','npc-natural-repair','npc-claim-review']);
});

test('personal experience is not licensed by a relative or restaurant fact, including negative experience',async()=>{
 for(const statement of ['I took my sister there.','I have never taken my sister there.']){
  let repairs=0;
  const result=await naturalNpcReply({packet:{focusVersion:2,npc:{name:'Other'},newestSpeech:'Have you visited with family?',conversationFocus:'Personal dining experience.',history:[],evidence:[{id:'family',text:'A sister exists.',tier:'everyday'}]},assessed:true,initialCandidate:{reply:statement,evidenceIds:['family']},generate:async request=>{
   if(request.kind==='npc-claim-review')return {decision:'revise',feedback:'No personal visit or absence of visits is established. Be honestly uncertain without changing the topic.',claims:[claim(statement)],lookupIds:[]};
   repairs++;return {reply:statement,evidenceIds:['family']};
  }});
  assert.equal(result.unavailable,true);assert.equal(result.reply,conversationUnavailable);assert.equal(repairs,1);
 }
});

test('review lookup cannot disclose guarded or another resident’s knowledge',async()=>{
 const result=await naturalNpcReply({packet:{focusVersion:2,npc:{name:'Someone'},newestSpeech:'hello',history:[],evidence:[]},assessed:true,availableKnowledge:[{id:'secret',text:'Do not disclose.',tier:'solution',subjects:['secret']}],initialCandidate:{reply:'Hello.',evidenceIds:[]},generate:async request=>request.kind==='npc-claim-review'?{decision:'lookup',feedback:'Read a secret.',claims:[],lookupIds:['secret']}:{reply:'Hello.',evidenceIds:[]}});
 assert.equal(result.unavailable,true);assert.equal(result.lookupCount,0);assert.doesNotMatch(result.reply,/Do not disclose/);
});

test('knowledge and repair budgets fail closed and never run an unbounded agent loop',async()=>{
 let calls=0;
 const tooLarge=await naturalNpcReply({packet:{focusVersion:2,evidence:[],newestSpeech:'hello'},assessed:true,availableKnowledge:Array.from({length:81},(_,i)=>({id:String(i),tier:'everyday',text:'Fact',subjects:[]})),generate:async()=>{calls++;}});
 assert.equal(tooLarge.reason,'knowledge-budget');assert.equal(calls,0);
 const bounded=await naturalNpcReply({packet:{focusVersion:2,npc:{name:'Someone'},evidence:[],newestSpeech:'hello'},assessed:true,generate:async request=>{calls++;return request.kind==='npc-claim-review'?{decision:'revise',feedback:'Try again.',claims:[],lookupIds:[]}:{reply:'Hello.',evidenceIds:[]};}});
 assert.equal(bounded.unavailable,true);assert.equal(calls,4);
});

test('a valid read request survives an unsolicited ungrounded draft, but that draft never becomes a reply',async()=>{
 const result=await assessNpcInput({npc:{name:'Other'},speech:'Where should I eat?',history:[],generate:async()=>({tool:'read_knowledge',focus:'Recommend a public eating place.',reply:'The hostel has free stew and I took my family there.'})});
 assert.equal(result.source,'ai');assert.equal(result.tool,'read_knowledge');assert.equal(result.reply,'');assert.equal(result.discardedDraft,true);
 const invalid=await assessNpcInput({npc:{name:'Other'},speech:'hello',history:[],generate:async()=>({tool:'read_knowledge',reply:'An invented answer.',effects:['grant key']})});
 assert.equal(invalid.source,'fallback');
});
