import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import {projectNpc} from '../server/scene-projection.mjs';
import {authoredNpcConversation,npcConversationTopic,renderNpcFacts} from '../server/npc-dialogue.mjs';
import roads from '../server/adventures/eldervale-roads.mjs';
import {projectLocalAtlas} from '../server/regional-atlas.mjs';
import {createDatabase,createPlayer,getParty,selectAdventure,setPartyState,getPartyState,getPlayer,listVisibleEvents} from '../server/database.mjs';
import {resolveAction} from '../server/dm.mjs';
import {validateAdventure} from '../server/adventure-schema.mjs';
const at=(location,flags={})=>createCanonicalState(roads,{currentLocation:location,flags});

test('conversation topic authoring rejects duplicate IDs, invalid types, malformed gates and state effects',()=>{
 assert.deepEqual(validateAdventure(roads).errors,[]);
 const definition=structuredClone(roads);
 definition.story.npcs['city-delvers-maps-resident'].conversation.topics=[{id:'same',kind:'invent',text:'',effects:[{op:'set'}],requires:[{}]},{id:'same',kind:'personal',text:'A reply.'}];
 const errors=validateAdventure(definition).errors.join(' ');assert.match(errors,/supported kind/);assert.match(errors,/duplicates a topic id/);assert.match(errors,/not effects/);assert.match(errors,/state path/);
});

test('broad social intent and follow-ups are reusable, not tied to a resident or destination',()=>{
 for(const text of ["what's happening",'what is going on around here','any news?','heard any rumours?','anything happening?','hows business?','what is new in town?'])assert.equal(npcConversationTopic(text),'local-news',text);
 assert.equal(npcConversationTopic('tell me about yourself'),'personal');
 assert.equal(npcConversationTopic('what else?'),'follow-up');
 assert.equal(npcConversationTopic('news about the missing prince?'),null);
 const projection={name:'Unrelated keeper',topics:[{id:'a',kind:'local-news',text:'“The public garden is open.”'},{id:'b',kind:'local-news',text:'“I enjoy tending the roses.”'}]};
 const one=authoredNpcConversation(projection,"what's happening");assert.equal(one.reply,projection.topics[0].text);
 const two=authoredNpcConversation(projection,'what else?',[one]);assert.equal(two.reply,projection.topics[1].text);
 const done=authoredNpcConversation(projection,'tell me more',[one,two]);assert.match(done.reply,/all I can vouch/);
 assert.equal(authoredNpcConversation(projection,'where is the hidden vault?'),null);
 assert.equal(authoredNpcConversation(projection,'Unrelated, any news?').reply,projection.topics[0].text);
});
test('authored speech is copied without nested quotation wrappers and Delvers intros are not dialogue facts',()=>{
 assert.equal(renderNpcFacts({},['“Maps matter,” says the keeper.'],{factIds:[0]}),'“Maps matter,” says the keeper.');
 const npc=roads.story.npcs['city-delvers-maps-resident'];
 assert.ok(!npc.conversation.publicFacts.some(fact=>fact.includes('weights a curling folio')));
 const projection=projectNpc(npc,at('city-delvers-maps'));
 assert.ok(projection.topics.every(topic=>!topic.id.endsWith('-returned')));
 const completed=projectNpc(npc,at('city-delvers-maps',{citySealReported:true}));
 assert.match(authoredNpcConversation(completed,'any news').reply,/report is in Hester/);
});
test('all nine Delvers contacts have individual everyday lives, follow-ups and personal conversation',()=>{
 const contacts=Object.values(roads.story.npcs).filter(npc=>npc.conversation?.topics?.length);
 assert.equal(contacts.length,9);const greetings=new Set(),news=new Set();
 for(const npc of contacts){
  const p=projectNpc(npc,at(npc.locations[0])),memory=[];
  const greet=authoredNpcConversation(p,'hello',memory);assert.ok(greet);greetings.add(greet.reply);
  const first=authoredNpcConversation(p,"what's happening",[greet]);assert.ok(first);news.add(first.reply);
  const second=authoredNpcConversation(p,'what else?',[greet,first]);assert.notEqual(first.reply,second.reply);assert.notEqual(second.topicId,null);
  assert.ok(authoredNpcConversation(p,'tell me about yourself').topicId);
 }
 assert.equal(greetings.size,9);assert.equal(news.size,9);
});
test('open-area map removes the route web, but strict maps and real descent links remain',()=>{
 const open=projectLocalAtlas(at('city-delvers-rope'));assert.deepEqual(open.routes,[]);assert.equal(open.sites.filter(site=>site.kind==='district-exit').length,5);
 assert.ok(open.sites.find(site=>site.id==='city-delvers-maps').available);
 const briefed=projectLocalAtlas(at('city-delvers-last',{cityDescentBriefed:true}));assert.deepEqual(briefed.routes.map(route=>route.to),['city-under-landing']);
 assert.ok(projectLocalAtlas(at('city-under-landing')).routes.length>0);
 assert.ok(projectLocalAtlas(at('village')).routes.length>0);
});
test('human Lethriel transcript answers locally, varies follow-ups and leaves canonical state unchanged',async()=>{
 const db=createDatabase(':memory:');try{
  const player=createPlayer(db,{partyId:'party-first-company',name:'Nigel',species:'Human',className:'Fighter'});
  selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');
  setPartyState(db,player.partyId,'world:eldervale-roads',at('city-delvers-rope'));
  const say=(text,mode='speak')=>resolveAction(db,getPlayer(db,player.id),mode,text);
  await say('go to Moth & Compass Maps','act');
  const before=getPartyState(db,player.partyId,'world:eldervale-roads');
  const replies=[];
  for(const text of ['hello',"what's happening",'what else?','tell me more','tell me about yourself']){
   await say(text);const event=listVisibleEvents(db,player).at(-1);assert.equal(event.speaker,'Lethriel Mossink');replies.push(event.text);
   assert.deepEqual(getPartyState(db,player.partyId,'world:eldervale-roads'),before);
  }
  assert.match(replies[1],/old names|surveyors/i);assert.doesNotMatch(replies[1],/weights a curling folio|Reading it does not move|““/);
  assert.match(replies[2],/Tavi|Dorrik/);assert.match(replies[3],/all I can vouch/);assert.equal(new Set(replies).size,5);
 }finally{db.close();}
});
