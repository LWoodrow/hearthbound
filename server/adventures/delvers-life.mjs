const flag = name => ({path:'flags.'+name, equals:true});
const set = name => ({op:'set',path:'flags.'+name,value:true});
const stories={
 rope:'“My first customer wanted a knot that untied itself. I sent him to the colleges. He came back for an ordinary bowline.”',
 maps:'“Two surveyors can agree on a street and still argue about which city it belongs to. Ysra keeps the old rebuilding records at Surveyors’ Hall.”',
 board:'“The old municipal seal is down at Seal Plaza. Hester wants its pattern recorded, not a chunk of stone carried upstairs.”',
 memorial:'“People stop here before a descent and after a return. The second visit matters more to me.”',
 gear:'“Most crews remember the sword and forget who is checking the return route. Ask Lethriel about the gallery before you choose Ward Street.”',
 hostel:'“Returned crews bring three things: wet boots, extraordinary appetites and four different versions of the same journey. Selka hears the versions; I deal with the boots.”',
 guild:'“A rebuilding index sounds dry until you realise it records a whole city learning to live above its own past. The public archive below still keeps that index.”',
};
const voices={rope:'Quick, teasing, precise about knots.',maps:'Thoughtful, gently argumentative about evidence.',board:'Brisk and dry, with affection for returning crews.',memorial:'Quiet, warm and unhurried.',gear:'Direct, practical, with a rumbling laugh.',hostel:'Sociable, amused by expedition boasting.',guild:'Measured, curious and fond of civic history.'};
const residents = [
  ['rope','Tavi Thimbleknot','Gnome ropeworker','A gnome with silver curls, rolled sleeves and a belt of coloured knot samples.',
   '“A good knot is one you can check,” Tavi says. “Tie the practice rope over the padded pit. Then ask Copper Buckle for a kit check before registering at the Exchange.”',
   ['The fixed practice rope is for tying and checking a bowline, not taking away.','A knot should be checked by a second pair of eyes. The maintained Last Lantern approach has a return stair, not a requirement to climb your own rope.']],
  ['maps','Lethriel Mossink','Elf cartographer','An elf with ink-stained fingertips and a green waistcoat, comparing two generations of street plans.',
   'Lethriel weights a curling folio. “Maps are arguments with evidence. Read the public survey folio for the maintained Last Lantern descent; the lower citadel is still sealed.”',
   ['The public survey folio supplies the same safety briefing as the Last Lantern ledger. Reading it does not move you.','Seal Plaza holds a municipal seal. Echo Gallery and Surveyors’ Refuge bypass the sentinel on Ward Street; the refuge chart explains the gate wheel.','Our annotations distinguish observed streets from rumours. There are no playable passages beyond the sealed Citadel Threshold.']],
  ['board','Dorrik Slate','Dwarf expedition clerk','A broad dwarf with a chalky beard, pinning return slips beside departure notices.',
   'Dorrik points to three boxes. “Briefing, practice knot, kit check. Finish those and register your expedition plan here. Hester handles the actual seal survey at the junction.”',
   ['Register an expedition plan here after reading a safety briefing, tying the practice rope at Three Knots and checking the kit at Copper Buckle.','The municipal-seal survey is optional civic work: copy the seal at Seal Plaza, then report it to Hester at the district junction.','Registration records preparation, not permission to skip the Last Lantern descent or an award of equipment.']],
  ['memorial','Nima Dawnstone','Aasimar memorial keeper','An aasimar in a weathered blue coat, polishing a plaque while daylight catches her pale eyes.',
   'Nima offers the public chalk. “The blank spaces are not an invitation to invent a tragedy. Leave a return promise on the slate if you like. Come back and tell me you kept it.”',
   ['The public return slate accepts a promise to return together; the chalk and plaques stay here.','The Returners’ Wall remembers crews without revealing private stories or naming unseen missing people.']],
  ['gear','Brakka Copperbuckle','Orc outfitter','An orc woman with a brass measuring tape and a patched leather apron, straightening a display pack.',
   'Brakka taps the demonstration harness. “Check the expedition kit with me. Advice is free; the display stays here. I will not pretend a look at a shield puts one in your hands.”',
   ['Check the expedition kit to review straps, lights and a return route. This advisory service grants no items, repairs or combat bonuses.','Tavi at Three Knots supervises a practice bowline; Dorrik at the Exchange records prepared expedition plans.']],
  ['hostel','Fen Underbough','Halfling hostel steward','A halfling in a striped knitted waistcoat, sorting return notices beside the drying court.',
   'Fen slides over the public return board. “Leave a return notice so people know which approach you plan to use. Beds and paid lodging are not bookable here yet; the courtyard is still a fine place to talk.”',
   ['Leave a return notice on the public board to record your intended maintained Last Lantern approach. It does not move you or reserve a room.','The Forty Beds stands just beyond the close district map. The public walking route remains open.','No paid lodging or mechanical rest/healing service is available here yet.']],
  ['guild','Ysra Glassscale','Dragonborn survey archivist','A copper-scaled dragonborn with spectacles, keeping public route records beneath a carved compass.',
   'Ysra opens the visitor register. “Hester takes the first seal report. After that, share your survey record here and we can compare it with the public rebuilding index.”',
   ['After reporting the municipal seal to Hester, share your survey record here for a public comparison. This does not grant guild membership or campaign levels.','The first city was rebuilt over, not erased. The archive index is reached through the operated municipal gate, not through this hall.']],
];

export function addDelversLife(locations, npcs, interactions, initialFlags) {
  for (const [key,name,role,appearance,greeting,facts] of residents) {
    const location='city-delvers-'+key, id=location+'-resident';
    npcs[id]={name,role,appearance,locations:[location],voice:voices[key],
      goals:['Help neighbours and returning crews'],knows:facts,mustNotKnow:['Private campaign discoveries','Unopened citadel depths'],
      conversation:{publicFacts:[appearance,greeting,...facts,stories[key]],conditionalFacts:[]},
      publicBackground:appearance+' '+stories[key]};
    locations[location].features.push({id,label:name,kind:'npc'});
    locations[location].occupants=[name,'neighbours and visiting crews'];
    locations[location].entryBeats.push({id:id+'-welcome',npc:id,text:greeting});
  }
  const tasks=[
    ['gear','kit-check',['check','review'],['expedition kit','kit display'], 'cityDelversKitChecked',
     'Brakka checks the demonstration straps with the company and reviews lights, a second knot check and a return route. Your preparation is recorded. Display equipment stays here; no inventory, repairs or combat bonuses are granted.',[]],
    ['board','register',['register','record'],['expedition plan'],'cityDelversPlanRegistered',
     'Dorrik records the briefing, practice knot and kit review in the expedition register. “The upper survey, with a return through Rope Landing. Come back together.” This is preparation, not a descent or a reward.',
     [flag('cityDescentBriefed'),flag('cityPastimecity-delvers-rope'),flag('cityDelversKitChecked')]],
    ['memorial','promise',['leave','write','record'],['return promise'],'cityDelversReturnPromise',
     'Nima records the company’s promise on the fixed return slate: come back together. The public chalk and memorial plaques stay here.',[]],
    ['hostel','notice',['leave','write','record'],['return notice'],'cityDelversReturnNotice',
     'Fen pins a public notice naming the maintained Last Lantern approach and Rope Landing return stair. Your notice is remembered; no bed is reserved and no rest or healing occurs.',[]],
    ['guild','compare',['share','compare','report'],['survey record'],'cityDelversSurveyCompared',
     'Ysra compares your reported municipal seal with the public rebuilding records. The company’s contribution is recorded in the visitor register. The deeper citadel remains sealed; no membership or campaign levels are awarded.',[flag('citySealReported')]],
  ];
  for (const [key,suffix,verbs,targets,name,message,requires] of tasks) {
    initialFlags[name]=false;
    const location='city-delvers-'+key, id=location+'-'+suffix;
    interactions.push({id,location,modes:['act'],verbs,targets,requires,effects:[set(name)],outcome:{message},
      blocked:{message:key==='board'?'Read the Last Lantern ledger or Moth & Compass folio, tie the practice rope at Three Knots, and check the expedition kit at Copper Buckle before registering.':'Report the municipal seal to Hester at the district junction before sharing the survey record here.'},
      repeat:{message:'This contribution is already recorded. '+message}});
    locations[location].features.push({id:id+'-feature',label:targets[0],kind:'scenery',
      observation:key==='board'?'The register asks for a safety briefing, a checked practice knot and an expedition kit review. Registering is a deliberate action.':message.replace(/^.*?\. /,'')});
    const npc=npcs[location+'-resident'];
    npc.conversation.conditionalFacts.push({requires:[{path:'flags.'+name,equals:false}],fact:'If you would like help or something useful to do here, '+verbs[0]+' the '+targets[0]+'. '+(key==='board'?'First read a safety briefing, tie the practice rope at Three Knots and check the expedition kit at Copper Buckle.':key==='guild'?'First report the municipal seal to Hester at the junction.':'This is an optional local contribution, not a purchase or combat reward.')});
    npc.conversation.conditionalFacts.push({requires:[flag(name)],fact:'Your visit is remembered. '+message});
  }
  // Inspection teaches what to do; it must not claim an unperformed service.
  const observations={gear:'Brakka offers a demonstration kit check. Deliberately check the expedition kit to record preparation; display items are not stock you can take.',memorial:'Nima keeps a public slate for return promises. Deliberately leave a return promise; no plaque is removed.',hostel:'Fen keeps a public return board. Deliberately leave a return notice; no bed, healing or mechanical rest is offered.',guild:'Ysra compares survey records after Hester receives the municipal-seal report. Deliberately share the survey record when ready.'};
  for(const [key,observation] of Object.entries(observations))locations['city-delvers-'+key].features.at(-1).observation=observation;
  npcs['city-delvers-rope-resident'].conversation.conditionalFacts.push({requires:[{path:'flags.cityPastimecity-delvers-rope',equals:false}],fact:'If you want help practising, tie the practice rope over the padded pit. The demonstration line stays here.'},{requires:[flag('cityPastimecity-delvers-rope')],fact:'“You have checked the practice bowline,” Tavi says. “Brakka can review the display kit, then Dorrik can register your prepared expedition.”'});
  npcs['city-delvers-maps-resident'].conversation.conditionalFacts.push({requires:[{path:'flags.cityDescentBriefed',equals:false}],fact:'If you need help with the descent, read the public survey folio here. It records the maintained Last Lantern approach and return stair.'},{requires:[flag('cityDescentBriefed')],fact:'Your safety briefing is recorded. Descend inside The Last Lantern to Rope Landing; its return stair remains open.'});
  npcs['city-delvers-memorial-resident'].conversation.conditionalFacts.push({requires:[flag('cityDelversReturnPromise'),flag('citySealReported')],fact:'“You kept your return promise,” Nima says. “Hester has the survey record, and you are upstairs again. That is the part worth remembering.”'});
  npcs['city-delvers-hostel-resident'].conversation.conditionalFacts.push({requires:[flag('cityDelversReturnNotice'),flag('citySealReported')],fact:'Fen marks your public notice returned after Hester’s survey report. “Good. One fewer name for somebody to worry about.”'});
  npcs['city-last-host'].conversation.publicFacts.push('Tavi at Three Knots teaches a practice bowline; Brakka at Copper Buckle checks the display kit; Dorrik at the Exchange registers prepared expedition plans. These are optional preparation, not extra descent requirements.','Nima keeps the Returners’ Wall and Fen the hostel return board. Ysra compares municipal survey records after you report to Hester.');
}
