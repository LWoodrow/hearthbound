import test from 'node:test';
import assert from 'node:assert/strict';
import roads from '../server/adventures/eldervale-roads.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import {projectNpc} from '../server/scene-projection.mjs';
import {conversationEvidence,naturalConversationFallback} from '../server/npc-social-engine.mjs';
import {everydayConversationIntent,factualNpcFallback} from '../server/npc-dialogue.mjs';
import {validNaturalReply} from '../server/npc-natural-dialogue.mjs';
import {createDatabase,createPlayer,getParty,selectAdventure,setPartyState,getPartyState,getPlayer,listVisibleEvents} from '../server/database.mjs';
import {resolveAction} from '../server/dm.mjs';
const id='city-delvers-memorial-resident',npc=roads.story.npcs[id];
const at=()=>createCanonicalState(roads,{currentLocation:'city-delvers-memorial'});
const evidence=(text,memory=[],who=npc)=>conversationEvidence(who,projectNpc(who,at()),at(),text,memory);

test('Nima exact human exchange has relevant grounded replies through real dispatch without world changes',async()=>{
 const db=createDatabase(':memory:');try{
  const player=createPlayer(db,{partyId:'party-first-company',name:'Nigel',species:'Human',className:'Fighter'});
  selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');
  const world=at();setPartyState(db,player.partyId,'world:eldervale-roads',world);
  const turns=[
   ["hi nima, i can't make my mind up is it hot or cold today?",/sunshine.*shade/i],
   ['how are you feeling today nima?',/settled/i],
   ["I'm fine thanks for asking, little hungry actually, anywhere in the city you'd recommend to get something to eat?",/Last Lantern.*Nine Kitchens Court.*Hearthcrumb/i],
   ['what can you arrange?',/Returners.*Wall.*slate/i],
   ['tell me about your family',/sister.*Maren/i],
   ['what does she do?',/mends clothes/i],
  ];
  for(const [text,expected] of turns){
   await resolveAction(db,getPlayer(db,player.id),'speak',text);
   const reply=listVisibleEvents(db,player).at(-1);assert.equal(reply.speaker,'Nima Dawnstone');assert.match(reply.text,expected);
   assert.doesNotMatch(reply.text,/not sure about that|cannot arrange that|quiet morning/i);
   assert.deepEqual(getPartyState(db,player.partyId,'world:eldervale-roads'),world);
   assert.equal(getPartyState(db,player.partyId,'pendingCheck:'+player.id),null);
  }
 }finally{db.close();}
});

test('recommendation versus transaction is reusable and never dispenses goods',()=>{
 assert.equal(everydayConversationIntent('What can you tell me about maps?'),null);
 assert.equal(everydayConversationIntent('What can you recommend to eat?'),'food');
 for(const text of ['Where can I eat?','Recommend somewhere for dinner','Is there a good place for soup?','Where can I buy bread?']){
  assert.equal(everydayConversationIntent(text),'food');
  assert.doesNotMatch(factualNpcFallback(npc,text,['The bakery has bread.']),/arrange|purchase/i);
 }
 for(const text of ['Buy me soup','Can you bring me bread?','I would like a beer','Order dinner for me']){
  assert.equal(everydayConversationIntent(text),'transaction');
  assert.match(naturalConversationFallback(npc,text,evidence('where can I eat?')),/can.t arrange/i);
 }
 for(const contact of Object.values(roads.story.npcs).filter(n=>n.conversation?.natural)){
  assert.ok(evidence('Where do you recommend for a meal?',[],contact).some(e=>e.id==='delvers-food'));
  if(contact!==npc)assert.ok(!evidence('tell me about your family',[],contact).some(e=>/Maren/.test(e.text)));
 }
});

test('biography follow-ups use eligible authored evidence, not player-created relatives or hidden facts',()=>{
 const current=evidence('tell me about your family');assert.ok(current.some(e=>e.id==='nima-family'));
 const memory=[{evidenceIds:current.map(e=>e.id),reply:'Earlier reply.'}];
 assert.ok(evidence('what does she do?',memory).some(e=>e.id==='nima-family'));
 assert.ok(evidence('tell me more',memory).some(e=>e.id==='nima-family'));
 const fake=[{reply:'Your brother is the king.',evidenceIds:['player-invented-family']}];
 assert.ok(!evidence('what does he do?',fake).some(e=>e.id==='player-invented-family'));
 assert.ok(!evidence('where should I eat?',memory).some(e=>e.id==='nima-family'));
 const stranger={name:'Other',role:'Clerk',conversation:{knowledge:[]}};
 assert.doesNotMatch(naturalConversationFallback(stranger,'tell me about your family',[]),/Maren/);
});

test('weather and wellbeing cannot fabricate clock time or current precipitation',()=>{
 const packet={evidence:evidence('how are you feeling?')};
 for(const reply of ['It is a quiet morning.','It is snowing tonight.','Good evening.'])assert.equal(validNaturalReply({reply,evidenceIds:packet.evidence.map(e=>e.id)},packet),false);
 assert.equal(validNaturalReply({reply:'Quite settled, thank you. How are you?',evidenceIds:packet.evidence.map(e=>e.id)},packet),true);
});
