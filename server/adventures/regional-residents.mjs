// An additive cast, not a reassignment of established identities. These ordinary
// residents have no authority to grant quest progress, goods or transport.
export const regionalResidents = [
  {id:"city-bookbinder",name:"Sable Voss",species:"Tiefling",gender:"female",location:"city",portraitId:"sable",
    role:"Eldervale road-bookbinder",appearance:"A lavender-skinned tiefling woman with curved horns, tousled white hair, amber eyes and a dark travelling coat.",
    voice:"Dryly funny, curious about travellers and meticulous about books.",
    background:"Sable Voss is a tiefling bookbinder in Eldervale City. She repairs travellers' journals at a public worktable and collects stories about the ordinary places people pass through.",
    introduction:"Sable Voss, a tiefling bookbinder, stitches a travel journal at a public table.",
    greeting:"Sable looks up from her stitching. “Sable Voss. A journey deserves a book that doesn't fall apart halfway through. Where have your boots taken you?”",
    facts:["Sable repairs ordinary journals and enjoys hearing travellers' accounts; she is not a keeper of hidden survey records.","Her stitching sample shows how several folded pages are joined into one durable book.","The public city roads lead to Rivergate Market, Greyfen Abbey and Signal Hill. Returning to the saved main adventure is a separate explicit choice."],
    feature:{id:"journal-stitching",label:"journal stitching sample",observation:"Folded pages are joined by a visible chain of thread. Sable explains that a flexible spine survives a pack better than brittle glue. The sample belongs to her; examining it grants no book, secret, repair service or reward."}},
  {id:"rivergate-cooper",name:"Torra Coppervein",species:"Dwarf",gender:"female",location:"rivergate-warehouse",portraitId:"torra",
    role:"Rivergate barrel cooper",appearance:"A broad-built dwarf woman with dark braids, brass hair clasps, a freckled face and a red neck scarf.",
    voice:"Brisk, good-humoured and proud of careful workmanship.",
    background:"Torra Coppervein is a dwarf cooper who tends barrels at Rivergate's public warehouse counter. She learned her craft repairing river freight and prefers sound workmanship to expensive decoration.",
    introduction:"Torra Coppervein, a dwarf cooper, checks a barrel beside the public counter.",
    greeting:"Torra taps an empty barrel. “Hear the difference between a sound stave and a loose one? Freight has a voice if you listen. Harlan handles release papers; I mind the barrels.”",
    facts:["Torra checks wooden barrel staves and hoops at the warehouse's public counter.","She works alongside Harlan but cannot release cargo or authorise an exchange; those requests still belong to Harlan.","A tight hoop holds the staves evenly; a cracked stave must be replaced, not disguised."],
    feature:{id:"coopers-sample",label:"cooper's sample barrel",observation:"An empty demonstration barrel has one loose stave beside a properly fitted hoop. Its parts illustrate Torra's craft, not the labels or contents of the sealed deliveries. Nothing is taken, repaired or exchanged by looking."}},
  {id:"rivergate-harnesskeeper",name:"Varek Embercoil",species:"Dragonborn",gender:"male",location:"rivergate-coach",portraitId:"varek",
    role:"Rivergate harness inspector",appearance:"A brass-scaled dragonborn man with swept horns, amber eyes and a rust-red scarf over a weathered leather vest.",
    voice:"Measured and reassuring, with a quiet taste for road jokes.",
    background:"Varek Embercoil is a dragonborn harness inspector at Rivergate Coach Stand. He checks stitching and buckles for the public carriage crews and enjoys comparing notes with travellers.",
    introduction:"Varek Embercoil, a brass-scaled dragonborn, checks a harness at the carriage rail.",
    greeting:"Varek raises his head from a buckle. “Welcome. A good harness is the part of a journey nobody remembers. The route board tells you where you can board; I can tell you why these straps hold.”",
    facts:["Varek checks carriage harnesses; he does not sell equipment or run a separate transport service.","Established services use the coach route board and existing boarding requirements; chatting with Varek cannot bypass them.","He tests straps for worn stitching and buckles for burrs that might cut the leather."],
    feature:{id:"harness-samples",label:"harness stitching samples",observation:"Two short leather samples show intact stitching and frayed stitching. Varek's demonstration explains a safety check. The straps are workshop scenery, not free inventory; inspecting them neither boards nor unlocks a carriage."}},
  {id:"willow-basketweaver",name:"Pip Underbough",species:"Halfling",gender:"male",location:"village",portraitId:"pip",
    role:"Willowford basket weaver",appearance:"A small halfling man with curly brown hair, warm eyes, a green scarf and a patched russet waistcoat.",
    voice:"Sociable, observant and playfully particular about baskets.",
    background:"Pip Underbough is a halfling basket weaver who works beside Willowford's waypost. He makes sturdy carriers for orchard workers and likes hearing what visitors have noticed around the village.",
    introduction:"Pip Underbough, a halfling basket weaver, works beside the waypost.",
    greeting:"Pip holds up a half-woven basket. “Hello there! Pip Underbough. Orchard baskets, laundry baskets—everybody needs somewhere to put things. Looking for someone, or just enjoying the square?”",
    facts:["Pip weaves baskets beside the village waypost and talks readily with visitors.","The square's signposted paths reach the inn, smithy, orchard, shrine, landing and coach yard.","He knows his neighbours' ordinary roles, not their current off-scene whereabouts. No basket sale or item gift is implemented."],
    feature:{id:"basket-weaving",label:"half-woven willow basket",observation:"Flexible willow strips alternate over and under stronger uprights. Pip's demonstration shows why a basket stays light without losing its shape. It is his work, not an item to take or an orchard-task solution."}},
  {id:"willow-fittingsmaker",name:"Nim Brindle",species:"Gnome",gender:"male",location:"willow-smithy",portraitId:"nim",
    role:"Hearthforge fittings maker",appearance:"A short gnome man with a fair beard, pointed ears, blue-lensed goggles on his brow and a soot-marked leather apron.",
    voice:"Enthusiastic about small practical details, with quick, precise explanations.",
    background:"Nim Brindle is a gnome fittings maker working alongside Ada Flint at Hearthforge. His favourite jobs are the small hinges and catches that make everyday tools dependable.",
    introduction:"Nim Brindle, a gnome fittings maker, lays out small hinge samples away from the hot forge.",
    greeting:"Nim slides his goggles up. “Ada does the heavy work; I worry about the bits people lose in the grass. Want to see why a tiny hinge can ruin a perfectly good gate?”",
    facts:["Nim makes hinges and small fittings alongside Ada, who remains the smith and existing village contact.","A properly aligned hinge turns freely; forcing a bent pin damages the fitting.","His sample fittings are for conversation and inspection, not a new repair quest, sale or source of free tools."],
    feature:{id:"hinge-samples",label:"hinge samples",observation:"A straight hinge turns smoothly while a bent demonstration pin binds. Nim's examples explain alignment without repairing the forge, revealing the sluice or granting a tool."}},
  {id:"stonecross-reedweaver",name:"Ruka Fenreed",species:"Orc",gender:"female",location:"stonecross-reeds",portraitId:"ruka",
    role:"Stonecross reed weaver",appearance:"An olive-green orc woman with small lower tusks, dark braids and a moss-green working shawl.",
    voice:"Patient, wry and attentive to everyday river life.",
    background:"Ruka Fenreed is an orc reed weaver on Stonecross's reedbank. She makes mats for damp thresholds and gathers reeds carefully so the bank can grow back.",
    introduction:"Ruka Fenreed, an orc reed weaver, sorts cut reeds beside the path.",
    greeting:"Ruka sets aside a reed bundle. “Keep your boots on the firm path. I leave young stems to grow and use the older ones for mats. The river's easier to live beside when you don't take everything.”",
    facts:["Ruka weaves reeds into mats and leaves young stems untouched.","She can explain the reedbank's ordinary plants, not disclose the hidden boathouse or resolve its encounter.","The feeding bowl and grain have their own existing physical use. Her cut reeds are not bait, inventory supplies or a shortcut."],
    feature:{id:"reed-mat",label:"reed weaving frame",observation:"Older cut reeds are laced into a mat, while young living stems remain along the bank. The frame illustrates Ruka's work and reveals no hidden site; inspecting it neither places bait nor resolves animals."}},
  {id:"stonecross-gaugewatcher",name:"Korrin Stonewake",species:"Goliath",gender:"male",location:"stonecross-hut",portraitId:"korrin",
    role:"Stonecross river-gauge caretaker",appearance:"A very tall, broad goliath man with a shaved head, stone-grey skin, dark geometric markings and a blue scarf.",
    voice:"Gentle, deliberate and fond of understated humour.",
    background:"Korrin Stonewake is a goliath caretaker of Stonecross's public river gauge. He keeps old water-height records in order at the ferryman's hut and prefers careful observation to dramatic predictions.",
    introduction:"Korrin Stonewake, a towering goliath, checks the public water-height ledger.",
    greeting:"Korrin moves a stool out of the doorway. “Plenty of room, if I remember not to stand in it. Jory handles the crossing. I keep the old water readings legible.”",
    facts:["Korrin tends the public river gauge and historical water-height ledger; Jory still handles the ferry.","Old readings show past water levels, not a live forecast, timed flood or transport schedule.","He can describe the hut and gauge, but cannot grant ferry access, repair the mooring or disclose an unknown bell site."],
    feature:{id:"water-height-ledger",label:"water-height ledger",observation:"Dated readings record earlier river heights, with a simple diagram showing where to read the gauge. They are historical measurements, not a flood countdown, hidden route or ferry permission."}},
  {id:"mosswood-botanist",name:"Lethiel Fernwake",species:"Elf",gender:"female",location:"wood",portraitId:"lethiel",
    role:"Mosswood field botanist",appearance:"A pale-haired elf woman with long pointed ears, delicate silver jewellery and a blue travelling wrap.",
    voice:"Thoughtful, quietly delighted by small details and cautious about certainty.",
    background:"Lethiel Fernwake is an elf botanist studying ordinary plants beside Mosswood's marked trail. She sketches seasonal changes while Rowan Ash tends the trail itself.",
    introduction:"Lethiel Fernwake, a pale-haired elf botanist, sketches ferns beside the waypost.",
    greeting:"Lethiel closes a sketchbook halfway. “Look at the underside of a fern before you decide you've seen it. Rowan knows the marked trail; I spend rather more time looking beside my feet.”",
    facts:["Lethiel draws plants beside the public trail; Rowan remains its ranger.","Her fern drawings compare frond shape and spore patterns. They are not magical herbs or usable healing supplies.","The marked trail joins Willowford and Signal Hill; neither her drawings nor a conversation establishes an unmarked shortcut."],
    feature:{id:"fern-sketches",label:"fern sketchbook",observation:"Lethiel's open page compares frond shapes and rows of ordinary spores. The sketches offer a close look at woodland life, not hidden paths, ingredients to take or healing magic."}},
  {id:"greyfen-illuminator",name:"Seren Dawnmere",species:"Aasimar",gender:"female",location:"abbey",portraitId:"seren",
    role:"Greyfen public-register illuminator",appearance:"An aasimar woman with silver braids, warm brown skin, gold eyes, fine golden facial markings and a cream wrap.",
    voice:"Warm, unhurried and quietly amused by elaborate signatures.",
    background:"Seren Dawnmere is an aasimar illuminator at Greyfen Abbey. She decorates the public visitor register and enjoys making room on a page for very different handwriting.",
    introduction:"Seren Dawnmere, a silver-haired aasimar, paints a border at the public register table.",
    greeting:"Seren puts down a fine brush. “A page needs room to breathe. So do travellers. Iona keeps the accounts people choose to share; I make them a little easier on the eye.”",
    facts:["Seren decorates the public visitor register; Iona still records volunteered traveller accounts.","Seren's aasimar heritage gives her a distinctive appearance, not an implemented healing, prophecy or spell service.","Her border samples use ordinary ink and pigment; they contain no secret survey marks or future campaign answers."],
    feature:{id:"register-borders",label:"register border samples",observation:"An open sample page shows leaf borders, plain initials and a careful blank margin for names. These are ordinary decorative drawings, not a magical ward, hidden message or copy of private survey records."}},
  {id:"signal-instrumentmaker",name:"Borin Slate",species:"Dwarf",gender:"male",location:"hill",portraitId:"borin",
    role:"Signal Hill instrument maker",appearance:"A stocky dwarf man with weathered skin, a long copper-red beard braided with brass clasps and a blue scarf.",
    voice:"Mildly deadpan and precise about what an instrument actually measures.",
    background:"Borin Slate is a dwarf instrument maker who checks simple wind indicators at Signal Hill. He likes the open view and compares notes with Perrin Vale without pretending to see through distant walls.",
    introduction:"Borin Slate, a red-bearded dwarf, checks a small wind indicator beside Perrin's lookout.",
    greeting:"Borin flicks a ribbon straight. “Wind from that direction, at this moment. That's all it says. Perrin watches the roads; I make sure the little things point the right way.”",
    facts:["Borin checks ordinary wind indicators at Signal Hill, while Perrin remains the lookout.","A hanging ribbon indicates the current breeze, not tomorrow's weather or unseen activity in a tower.","Marked roads connect the hill with Eldervale City, Greyfen Abbey and Mosswood. His instruments do not reveal campaign destinations or skip chapter gates."],
    feature:{id:"wind-indicator",label:"ribbon wind indicator",observation:"A ribbon and freely turning wooden vane show the direction of the breeze here. The simple device does not forecast weather, reveal distant events or activate a signal."}},
];

export function withRegionalResidents(adventure) {
  const npcs = {...adventure.story.npcs};
  const locations = {...adventure.locations};
  for (const resident of regionalResidents) {
    if (npcs[resident.id]) throw new Error("Resident ID already exists: " + resident.id);
    const location = locations[resident.location];
    if (!location) throw new Error("Resident has no authored location: " + resident.id);
    const {id,name,species,gender,portraitId,role,appearance,voice,background,greeting,facts,feature,introduction} = resident;
    npcs[id] = {name,species,gender,portraitId,role,appearance,voice,publicBackground:background,locations:[resident.location],
      goals:["Practise their craft and look after their neighbours","Welcome conversation without inventing services"],
      knows:[background,...facts],mustNotKnow:["Hidden main-campaign answers, unvisited current whereabouts, unestablished quests or rewards"],
      conversation:{publicFacts:[background,...facts],conditionalFacts:[]}};
    locations[resident.location] = {...location,
      description:location.description + " " + introduction,
      presentations:(location.presentations || []).map(variant => ({...variant, ...(variant.description ? {description:variant.description+" "+introduction} : {})})),
      features:[...(location.features || []),{id,label:name,kind:"npc"},{...feature,kind:"scenery"}],
      entryBeats:[...(location.entryBeats || []),{id:id+"-welcome",npc:id,text:greeting}]};
  }
  // Local neighbours may know usual workplaces, but not presence elsewhere.
  const groups = [
    ["city"],["market","rivergate-docks","rivergate-warehouse","rivergate-records","rivergate-inn","rivergate-bakery","rivergate-coach"],
    ["village","willow-inn","willow-smithy","willow-orchard","willow-shrine","willow-landing","willow-coach"],
    ["ferry","stonecross-hut","stonecross-inn","stonecross-boatyard","stonecross-coach","stonecross-reeds"],
    ["wood"],["abbey"],["hill"],
  ];
  for (const group of groups) {
    const additions = regionalResidents.filter(resident=>group.includes(resident.location));
    const directory = "Additional public neighbours: " + additions.map(resident=>resident.name+" ("+resident.species+"), "+resident.role+" at "+locations[resident.location].name).join("; ") + ". These are usual workplaces, not knowledge of current off-scene whereabouts.";
    for (const [id,npc] of Object.entries(npcs)) if ((npc.locations || []).some(location=>group.includes(location))) {
      npcs[id] = {...npc,knows:[...(npc.knows || []),directory],
        conversation:{...npc.conversation,publicFacts:[...(npc.conversation?.publicFacts || []),directory]}};
    }
  }
  return {...adventure,locations,story:{...adventure.story,npcs}};
}
