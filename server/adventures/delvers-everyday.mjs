// Reviewed local knowledge shared by the Delvers cast, not invented by the
// narrator. Stable geography/advice only: no clock, current weather or commerce.
const shared=[
 {id:'delvers-food',subjects:['everyday:food','hungry','eat','recommend','meal'],text:'Food recommendations: the Last Lantern is nearby in Delvers’ Quarter; Nine Kitchens Court is in the Grand Exchange; Hearthcrumb Bakery is in Lantern Ward. These are public recommendations, not evidence of anyone’s past visits, favourite dish, menu, prices or current ambience.'},
 {id:'delvers-weather',subjects:['everyday:weather','hot','cold','weather'],text:'“These stone streets can feel quite different in sunshine and in shade. I would keep a layer handy rather than trust one sheltered corner. Are you too warm, or wishing you had brought a coat?”'},
];

export function addDelversEveryday(npcs,ids) {
 for(const id of ids){
  const npc=npcs[id];
  npc.conversation.knowledge.push(...shared.map(entry=>({...entry,tier:'everyday'})));
  npc.conversation.knowledge.push({id:id+'-wellbeing',tier:'everyday',subjects:['everyday:wellbeing'],text:`“There is always something to interest me with ${npc.personality.interests.join(' and ')}. How are you getting on?”`});
 }
 const nima=npcs['city-delvers-memorial-resident'];
 nima.conversation.mode='one-pass';
 nima.conversation.life={
  present:'Tending the public slate and polishing brass while making room for ordinary conversation, not conducting a solemn ceremony.',
  motivations:['Help people feel welcome before and after a descent.','Make useful things and care for people without prying.'],
  pleasures:['Mending small household things.','Listening to ordinary stories rather than expedition boasting.','Unhurried company and gentle teasing with her sister.'],
  worries:['Bravery being mistaken for refusing help.','Being treated only as the keeper of a solemn wall rather than as a neighbour.'],
  ambitions:['Make the Wall welcoming for ordinary visits as well as return promises.','Keep time for making useful things with Maren.'],
  boundaries:['Happy to talk about Maren and her own life; unwilling to gossip about another person’s grief.'],
  family:{sister:{name:'Maren',relationship:'younger sister',occupation:'mends clothes',bond:'Close; she teases Nima about polishing brass while thinking.'},upbringing:'Their parents taught them to repair things before throwing them away.'},
 };
 nima.conversation.knowledge.push(
  {id:'nima-family',tier:'everyday',subjects:['everyday:family','family','sister','Maren','parents','upbringing','occupation'],text:'Nima has a younger sister named Maren. Maren mends clothes. Their parents taught them to repair things before throwing them away.'},
  {id:'nima-family-bond',tier:'everyday',subjects:['everyday:family','Maren','sister','relationship'],text:'Nima and Maren are close. Maren teases Nima for polishing brass while thinking. Both sisters enjoy making useful things with their hands.'},
  {id:'nima-work',tier:'everyday',subjects:['everyday:capabilities','work','arrange','help','promise','slate'],text:'Nima cares for the Returners’ Wall and public slate. Visitors may leave a return promise, sit or talk. She offers public directions and company, not room bookings or meal delivery.'},
 );
 const wellbeing=nima.conversation.knowledge.find(entry=>entry.id==='city-delvers-memorial-resident-wellbeing');
 wellbeing.text='Nima is settled and enjoys tending small practical tasks while people find their words; quiet ordinary conversation is welcome.';
}
