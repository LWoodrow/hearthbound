// Rivergate is authored content, not an executor special case. Preserve market
// and courier IDs so existing regional saves gain the hub without a migration.
const flag=(name,value=true)=>({path:"flags."+name,equals:value});
const set=(name,value=true)=>({op:"set",path:"flags."+name,value});
const resolved=flag("deliveryResolved");
export const rivergatePlaces=[
  {id:"market",name:"Rivergate Market",x:47,y:46,aliases:["market square","Rivergate square"],description:"Canvas stalls crowd a riverfront market square. A courier sorts letters beside the public wayboard; lanes lead to the docks, bonded warehouse, records office, Blue Heron inn, bakehouse and coach stand.",npc:"courier",features:[{id:"rivergate-wayboard",label:"market wayboard",kind:"scenery",observation:"Public lanes connect the square to the six local places. Regional roads lead to Eldervale City and Stonecross Ferry."}]},
  {id:"rivergate-docks",name:"Rivergate Docks",x:86,y:58,aliases:["docks","quay","river docks"],description:"Workboats rock beside the timber quay. Two sealed deliveries wait under an awning while the dockmaster checks the loading board.",npc:"rivergate-dockmaster",features:[{id:"cargo-labels",label:"sealed delivery labels",kind:"scenery",observation:"The dock labels can be compared with the loading board without opening or taking anyone's goods.",presentations:[{requires:[resolved],observation:"The corrected consignment is assigned to its proper receiver. No further exchange is needed."}]},{id:"loading-board",label:"loading board",kind:"scenery",observation:"A public loading board lists receiver marks for the waiting deliveries."}],presentations:[{requires:[resolved],description:"The dock crew has set the corrected delivery aside for its proper receiver. Workboats and the public warehouse lane remain here."}]},
  {id:"rivergate-warehouse",name:"Bonded Warehouse",x:70,y:31,aliases:["warehouse","storehouse"],description:"A timber warehouse holds sealed goods pending release. Its keeper works at a public counter; freight behind the counter is not the company's property.",npc:"rivergate-warehousekeeper",features:[{id:"release-counter",label:"release counter",kind:"scenery",observation:"The keeper can authorise an exchange of the misdirected sealed deliveries. Asking is not the same as moving cargo."}]},
  {id:"rivergate-records",name:"Rivergate Records Office",x:64,y:70,aliases:["records office","clerk office"],description:"A stone office opens onto a public desk with a receiver register and duplicate delivery manifest.",npc:"rivergate-clerk",features:[{id:"delivery-manifest",label:"delivery manifest",kind:"scenery",observation:"Compare the public manifest with the receiver register to verify which sealed delivery was misdirected."}]},
  {id:"rivergate-inn",name:"The Blue Heron",x:28,y:34,aliases:["Blue Heron","market inn"],description:"A blue-roofed inn offers a quiet public parlour away from the market bustle. A noticeboard hangs beside the hearth.",npc:"rivergate-host",features:[{id:"road-notices",label:"road noticeboard",kind:"scenery",observation:"Public notices recommend the road through Signal Hill toward Briarwatch. The tower investigation is a separate main adventure, not a shortcut or completed chapter."},{id:"parlour-bench",label:"parlour bench",kind:"scenery",observation:"A quiet place to sit and talk. No purchase, lodging, healing or resource restoration is implied."}]},
  {id:"rivergate-bakery",name:"Brind Bakehouse",x:26,y:66,aliases:["bakery","bakehouse"],description:"Warm bread scents a small stone bakehouse. Its baker pauses beside a cooling rack to speak with travellers.",npc:"rivergate-baker",features:[{id:"cooling-rack",label:"cooling rack",kind:"scenery",observation:"Loaves on the rack belong to the bakery. Purchases and taking stock are not implemented here."}]},
  {id:"rivergate-coach",name:"Rivergate Coach Stand",x:43,y:15,aliases:["coach stand","carriage stand"],description:"Horses rest at a public carriage yard. A route board lists the established city and Willowford services; a lane returns to the market square.",features:[{id:"rivergate-coach-board",label:"coach route board",kind:"scenery",observation:"Board established carriages here or at Rivergate Market. City service needs the connecting road visited; Willowford service also needs the connecting stops visited and Stonecross mooring repaired. This introductory service has no fare."}]},
];
export const rivergateLinks=rivergatePlaces.filter(place=>place.id!=="market").map(place=>["market",place.id]).concat([["rivergate-docks","rivergate-warehouse"]]);
export const rivergateCommunityFacts=[
  "Rivergate's public directory lists Elin Marr, courier in the market; Dain Mercer, dockmaster at Rivergate Docks; Harlan Moss, keeper at Bonded Warehouse; Vera Senn, clerk at Records Office; Osric Vale, host of the Blue Heron; and Nella Brind, baker at Brind Bakehouse.",
  "These are usual workplaces, not knowledge of off-scene current whereabouts. Public lanes lead through the market square; the docks also connect to the warehouse.",
  "Rivergate has public roads to Eldervale City and Stonecross Ferry. Carriages board at the market square or Rivergate Coach Stand, not remotely from a business.",
  "Briarwatch is a destination of the separate Hollow Road main adventure. Local rumours do not complete it or grant access to later chapters.",
];
const character=(name,role,location,portraitId,appearance,voice,facts,greeting,conditionalFacts=[])=>({
  name,role,locations:[location],portraitId,appearance,voice,
  goals:["Keep Rivergate's trade fair","Welcome travellers without inventing sales, rewards or main-story answers"],
  knows:[...rivergateCommunityFacts,...facts],mustNotKnow:["Hidden campaign culprits, future chapter answers, unestablished people or current off-scene whereabouts"],
  conversation:{publicFacts:[...rivergateCommunityFacts,...facts],conditionalFacts},greeting,
});
const statusFacts=[
  {requires:[flag("deliveryResolved",false)],fact:"A pair of sealed deliveries has been misdirected. Verify the receiver using dock labels/loading board or the records-office manifest, or request the warehouse keeper's explicit exchange authority. Physical sorting happens at the docks."},
  {requires:[flag("deliveryEvidence")],fact:"The manifest and receiver marks identify the crossed delivery labels; the cargo itself is intact."},
  {requires:[flag("deliveryExchangePermission")],fact:"The warehouse keeper has authorised exchanging the two intact sealed deliveries at the docks."},
  {requires:[resolved],fact:"The delivery is corrected; no cargo, coins or campaign levels were awarded to the company."},
];
export const rivergateNpcs={
  courier:character("Elin Marr","Rivergate courier","market","elin","Dark curls, rust travel cloak and a canvas satchel.","Quick-witted, curious and practical.",
    ["Elin carries ordinary letters between river settlements.","Elin is the local contact for the delivery problem. Ask about the delivery, work or local trouble."],
    "Elin sorts letters beneath a canvas awning. “Welcome back to the river roads. Two sealed deliveries have crossed labels. If you fancy helping, ask me about the delivery; there are people worth meeting here either way.”",statusFacts),
  "rivergate-dockmaster":character("Dain Mercer","Rivergate dockmaster","rivergate-docks","dain","Close-shaved hair, short grey beard and a navy work coat.","Calm, fair and economical.",
    ["Dain oversees the quay; waiting cargo belongs to its receivers.","The loading board and sealed labels can verify a receiver without breaking seals."],
    "Dain rests a hand on the loading board. “Look before you lift. If a label's wrong, the receiver marks will tell us.”",statusFacts),
  "rivergate-warehousekeeper":character("Harlan Moss","Bonded Warehouse keeper","rivergate-warehouse","harlan","Greying red hair and a worn leather work vest.","Cautious, direct and fair.",
    ["Harlan can explicitly authorise exchanging the two sealed deliveries after Elin's problem is established.","Authority to exchange is not proof that the cargo has moved."],
    "Harlan looks up from the counter. “Goods stay sealed here. If you're helping Elin, ask about exchange permission rather than helping yourself.”",statusFacts),
  "rivergate-clerk":character("Vera Senn","Rivergate records clerk","rivergate-records","vera","Silver bob, plain spectacles and a plum jacket.","Patient and precise.",
    ["Vera keeps the duplicate manifest and receiver register at the public desk.","Public records can verify a delivery independently of the docks."],
    "Vera lays a duplicate manifest on the desk. “Labels can be wrong. Receiver records are how we put them right.”",statusFacts),
  "rivergate-host":character("Osric Vale","Blue Heron innkeeper","rivergate-inn","osric","Sandy moustache, sage waistcoat and a linen shirt.","Warm, talkative but careful about rumours.",
    ["The Blue Heron is a public meeting place; purchases, rooms and healing are not implemented.","Travellers speak of a rekindled tower near Briarwatch. Osric knows no cause or secret route.","Read the public noticeboard for directions; continue the saved main adventure explicitly, not by skipping chapter gates."],
    "Osric waves toward the parlour. “A little quiet? The noticeboard has road news, and I'm happy to talk. That old tower near Briarwatch has everyone curious.”"),
  "rivergate-baker":character("Nella Brind","Brind baker","rivergate-bakery","nella","Dark hair wrapped in pale cloth and a flour-dusted apron.","Lively, attentive to ordinary lives.",
    ["Nella bakes for market workers and travellers.","Her usual deliveries go to the docks and inn, but no live delivery schedule is simulated.","The cooling stock is not free equipment or an automatic purchase."],
    "Nella brushes flour from her apron. “Road dust and market noise—I know that look. Who have you met so far?”"),
};
export const rivergateLocations=Object.fromEntries(rivergatePlaces.map(place=>[place.id,{
  name:place.name,description:place.description,aliases:[place.name,...place.aliases],stage:0,
  // The fallback adventure sketch uses a separate town block. Local plate
  // percentages must not overlap another settlement's fallback room geometry.
  map:{x:150+place.x,y:place.y,w:18,h:14,kind:"court",label:place.name},presentations:place.presentations||[],
  features:[...place.features,...(place.npc?[{id:place.npc,label:rivergateNpcs[place.npc].name,kind:"npc"}]:[])],
  occupants:place.id==="market"?["traders tending canvas stalls","porters carrying baskets across the square"]:place.id==="rivergate-coach"?["stable hands tending the carriage horses"]:[],
  ...(place.id==="market"?{ambientGreeting:"A stallholder returns the greeting and points toward the public wayboard."}:place.id==="rivergate-coach"?{ambientGreeting:"A stable hand nods hello and points back to the market boarding place."}:{}),
  exits:rivergateLinks.filter(link=>link.includes(place.id)).map(link=>{const to=link.find(id=>id!==place.id);return {to,via:"public lane to "+rivergatePlaces.find(p=>p.id===to).name};}),
  entryBeats:place.npc?[{id:place.npc+"-rivergate-welcome",npc:place.npc,text:rivergateNpcs[place.npc].greeting,...(["courier","rivergate-dockmaster","rivergate-warehousekeeper","rivergate-clerk"].includes(place.npc)?{requires:[flag("deliveryResolved",false)]}:{})}]:[],
}]));
const interaction=(id,location,modes,verbs,targets,effects,message,extra={})=>({id,location,modes,verbs,targets,effects,outcome:{message},...extra});
const evidence=[set("deliveryEvidence"),{op:"add",path:"discoveries",value:"rivergate-receiver"}];
const resolvedEffects=method=>[set("deliveryResolved"),set("deliveryMethod",method),{op:"add",path:"discoveries",value:"rivergate-delivery"}];
export const rivergateInteractions=[
  interaction("rivergate-delivery-invitation","market",["act","speak"],["ask","request"],["delivery","work","trouble","help"],[set("deliveryKnown")],
    "Elin explains that two intact sealed deliveries have crossed labels. Compare receiver marks at the docks or the duplicate manifest in the records office; alternatively, ask Harlan at the warehouse for authority to exchange them. Return to Elin after arranging the correction at the docks.",
    {requires:[flag("deliveryResolved",false)],repeat:{message:"Elin's request is recorded: receiver verification uses the docks or records office; exchange authority comes from the warehouse; correction happens at the docks and report-back at the market. Any completed correction remains complete."}}),
  ...[["rivergate-docks",["labels","receiver marks","loading board"]],["rivergate-records",["manifest","register","records"]]].map(([location,targets])=>interaction("rivergate-verify-"+location,location,["act"],["inspect","read","compare","examine","check"],targets,evidence,
    "The public records and receiver marks establish crossed labels on two intact sealed deliveries. Dain can redirect the correct consignment at the docks once you arrange it. Nothing has been moved or taken.",
    {requires:[flag("deliveryResolved",false)],repeat:{message:"The receiver marks confirm the original crossed labels. This inspection moves no cargo and does not undo a completed correction. Physical corrections take place at the docks."}})),
  interaction("rivergate-permit-exchange","rivergate-warehouse",["act","speak"],["ask","request"],["exchange permission","permission","authorisation"],[set("deliveryExchangePermission")],
    "Harlan records authority to exchange the two sealed deliveries at the docks. “Keep both seals intact and let Dain supervise.” Cargo has not moved.",
    {requires:[flag("deliveryKnown"),flag("deliveryResolved",false)],blocked:{message:"First ask Elin in the market about the delivery problem. No exchange authority is recorded after a correction is already complete."},repeat:{message:"Harlan's exchange authority is recorded. An exchange takes place at the docks; repeating the request never undoes a completed correction."}}),
  interaction("rivergate-redirect-delivery","rivergate-docks",["act"],["arrange","redirect","correct"],["delivery","consignment"],resolvedEffects("verified"),
    "Using the verified receiver marks, the company and Dain redirect the correct sealed consignment. The delivery is corrected without opening or taking cargo. Return to Elin in the market.",
    {requires:[flag("deliveryEvidence"),flag("deliveryResolved",false)],blocked:{message:"Verify the receiver marks at the docks or records office first. A resolved delivery needs no further correction."},repeat:{message:"The delivery is already corrected. No second cargo move or reward is granted."}}),
  interaction("rivergate-exchange-deliveries","rivergate-docks",["act"],["exchange","swap"],["deliveries","cargo","consignments"],resolvedEffects("exchange"),
    "With Harlan's recorded authority and Dain supervising, the company exchanges the two intact sealed deliveries. The receivers now have the correct consignments. Return to Elin in the market.",
    {requires:[flag("deliveryExchangePermission"),flag("deliveryResolved",false)],blocked:{message:"Ask Harlan at the warehouse for exchange permission first. A resolved delivery needs no further exchange."},repeat:{message:"The delivery is already corrected; no duplicate exchange or reward is granted."}}),
  interaction("rivergate-report-delivery","market",["act","speak"],["tell","report","share"],["delivery","correction","news"],[set("deliveryReported")],
    "Elin checks the corrected assignment and thanks the company. “Come back and tell me how the roads treat you. Travellers passing Signal Hill keep asking after Briarwatch's rekindled tower.” Rivergate's task is complete; the saved main adventure, inventory and earned levels are unchanged.",
    {requires:[resolved],blocked:{message:"Arrange the correction at the docks before reporting success to Elin."},repeat:{message:"Elin remembers the help and welcomes news from the company's travels. The delivery stays corrected; no duplicate reward is awarded."}}),
];
export const rivergateFlags={deliveryKnown:false,deliveryEvidence:false,deliveryExchangePermission:false,deliveryResolved:false,deliveryReported:false,deliveryMethod:""};
export const rivergateDiscoveries={"rivergate-receiver":{name:"Receiver marks verified"},"rivergate-delivery":{name:"Rivergate delivery corrected"}};
export const rivergateClues={"rivergate-receiver":{fact:"Two intact deliveries have crossed labels; public receiver records identify their correct assignments.",essential:true,unlocks:"Evidence-based correction at the docks",sources:[{location:"rivergate-docks",methods:["Compare the sealed labels with the loading board"],outcome:"Verify receiver marks without moving cargo."},{location:"rivergate-records",npc:"rivergate-clerk",methods:["Read or compare the duplicate manifest"],outcome:"Independently verify the same receiver assignment."}]}};
export const rivergateAtlas={id:"rivergate",title:"Rivergate Market",root:"market",image:"/art/maps/rivergate-local-v1.png",places:rivergatePlaces,links:rivergateLinks,
  imageAlt:"Illustrated Rivergate trading quarter with public market square, warehouse, docks, records office, inn, bakehouse and coach stand. Interactive destinations are marked separately.",
  introduction:"Explore the market stalls, riverside businesses and public lanes. Markers identify enterable places; decoration does not create shops or purchases.",
  returnHint:"Return to the market square for the regional roads. Established public carriages board there or at Rivergate Coach Stand.",
  actionIds:["rivergate-delivery-invitation","rivergate-verify-rivergate-docks","rivergate-verify-rivergate-records","rivergate-permit-exchange","rivergate-redirect-delivery","rivergate-exchange-deliveries","rivergate-report-delivery"],
  taskStages:[
    {requires:[flag("deliveryReported")],text:"Elin remembers your help. Return for conversation and road news; Rivergate's delivery task remains complete."},
    {requires:[resolved],text:"The delivery is corrected. Report back to Elin in the market square."},
    {requires:[flag("deliveryExchangePermission")],text:"Exchange authority is recorded. Arrange the sealed delivery exchange at the docks."},
    {requires:[flag("deliveryEvidence")],text:"Receiver marks are verified. Arrange the correction at the docks; inspection has not moved cargo."},
    {requires:[flag("deliveryKnown")],text:"Verify the receiver at the docks or records office, or request warehouse exchange authority. The correction itself happens at the docks."},
    {requires:[],text:"Meet the residents, read public road notices, or ask Elin in the market about work."},
  ]};
