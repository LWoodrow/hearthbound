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
 nima.conversation.knowledge.push(
  {id:'nima-family',tier:'everyday',subjects:['everyday:family','family','sister','Maren','parents','upbringing','occupation'],text:'Nima has a younger sister named Maren. Maren mends clothes. Their parents taught them to repair things before throwing them away.'},
  {id:'nima-family-bond',tier:'everyday',subjects:['everyday:family','Maren','sister','relationship'],text:'Nima and Maren are close. Maren teases Nima for polishing brass while thinking. Both sisters enjoy making useful things with their hands.'},
  {id:'nima-work',tier:'everyday',subjects:['everyday:capabilities','work','arrange','help','promise','slate'],text:'“I care for the Returners’ Wall and its slate. You can leave a return promise here, or simply sit and talk. I can listen and point you towards public places; I cannot book a room or fetch a meal for you.”'},
 );
 const wellbeing=nima.conversation.knowledge.find(entry=>entry.id==='city-delvers-memorial-resident-wellbeing');
 wellbeing.text='“Quite settled, thank you. I like having something small to tend to while people find their words. How are you getting on?”';
}
