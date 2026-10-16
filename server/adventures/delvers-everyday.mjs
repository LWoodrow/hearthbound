// Reviewed local knowledge shared by the Delvers cast, not invented by the
// narrator. Stable geography/advice only: no clock, current weather or commerce.
const shared=[
 {id:'delvers-food',subjects:['everyday:food','hungry','eat','recommend','meal'],text:'“For somewhere nearby, I would try the Last Lantern, here in Delvers’ Quarter. If you fancy seeing more of the city, there is Nine Kitchens Court in the Grand Exchange, or Hearthcrumb Bakery in Lantern Ward. Which sounds more like what you want?”'},
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
  {id:'nima-family',tier:'everyday',subjects:['everyday:family','family','sister','Maren','parents'],text:'“My younger sister is Maren. She mends clothes, and is much less patient with a badly sewn cuff than I am with a long silence. Our parents taught us to repair things before throwing them away. I think we both kept that habit.”'},
  {id:'nima-family-bond',tier:'everyday',subjects:['everyday:family','Maren','sister','relationship'],text:'“Maren and I are close, though she teases me for polishing brass when I am thinking. We both like making something useful with our hands.”'},
  {id:'nima-work',tier:'everyday',subjects:['everyday:capabilities','work','arrange','help','promise','slate'],text:'“I care for the Returners’ Wall and its slate. You can leave a return promise here, or simply sit and talk. I can listen and point you towards public places; I cannot book a room or fetch a meal for you.”'},
 );
 const wellbeing=nima.conversation.knowledge.find(entry=>entry.id==='city-delvers-memorial-resident-wellbeing');
 wellbeing.text='“Quite settled, thank you. I like having something small to tend to while people find their words. How are you getting on?”';
}
