const flag=(name,value=true)=>({path:'flags.'+name,equals:value});
const set=name=>({op:'set',path:'flags.'+name,value:true});
const profiles={
 'city-delvers-maps-resident':{traits:['curious','guarded','dryly humorous'],mood:'absorbed but approachable',values:['accuracy','honest uncertainty'],interests:['old street names','corrections in margins'],mannerisms:['brief thoughtful pauses','gentle disagreement'],boundaries:['Never allow threats to buy confidential annotations.'],bonds:['Respects Tavi’s practical care and Ysra’s record keeping.']},
 'city-last-host':{traits:['cheery','protective','shrewd'],mood:'welcoming',values:['safe returns','hospitality without boasting'],interests:['expedition stories','the people behind banners'],mannerisms:['warm humour','direct questions'],boundaries:['Never reveal a guest’s private business because someone threatens her.'],bonds:['Works with Hester to keep crews safe.']},
 'city-delvers-resident':{traits:['stern','fair','quietly affectionate'],mood:'busy',values:['accountability','every crew member returning'],interests:['careful accounts','ordinary acts of courage'],mannerisms:['short sentences','dry understatement'],boundaries:['No false expedition records.'],bonds:['Trusts Selka’s concern for returned crews.']},
 'city-delvers-rope-resident':{traits:['cheerful','patient','mischievous'],mood:'energetic',values:['practical competence','letting beginners learn'],interests:['knots','absurdly elaborate requests'],mannerisms:['playful questions','concise practical explanations'],boundaries:['No unsafe demonstrations.'],bonds:['Respects Brakka’s kit checks.']},
 'city-delvers-board-resident':{traits:['grumpy','conscientious','generous beneath a brusque manner'],mood:'preoccupied',values:['honesty','returning crews'],interests:['precise records','understated jokes'],mannerisms:['clipped replies that soften with respect'],boundaries:['Will not falsify a register or be bullied into endorsing an unprepared crew.'],bonds:['Values Hester’s register and Tavi’s practical preparation.']},
 'city-delvers-memorial-resident':{traits:['gentle','observant','steadfast'],mood:'calm',values:['dignity','listening'],interests:['ordinary memories','the work of caring for a place'],mannerisms:['allows pauses','never presses someone to disclose grief'],boundaries:['No exploiting a memorial for leverage.'],bonds:['Appreciates Fen’s return board.']},
 'city-delvers-gear-resident':{traits:['blunt','good-humoured','meticulous'],mood:'businesslike',values:['well-made equipment','honest advice'],interests:['repairing her own apron','practical preparation'],mannerisms:['plain language','a dry joke rather than a sales pitch'],boundaries:['No pretending a display is free stock.'],bonds:['Shares Tavi’s belief in checking each other’s work.']},
 'city-delvers-hostel-resident':{traits:['sociable','cheery','unimpressed by boasting'],mood:'relaxed',values:['belonging','safe returns'],interests:['everyday stories','the gap between a boast and a wet boot'],mannerisms:['gentle teasing','invites rather than interrogates'],boundaries:['No fabricated bookings or gossip about private guests.'],bonds:['Enjoys Selka’s stories and respects Nima’s quieter care.']},
 'city-delvers-guild-resident':{traits:['reserved','inquisitive','proud but willing to be corrected'],mood:'thoughtful',values:['evidence','preserving ordinary history'],interests:['reused stones','competing drawings'],mannerisms:['precise but not technical','asks what someone observed'],boundaries:['Membership is not granted through flattery.'],bonds:['Values Lethriel’s corrections and Hester’s returned surveys.']},
};
function challenge(id,targets,approaches,reason,success,failure,extra={}) {
 return {id,targets,approaches,reason,requires:[],retryOn:['flags.citySealCopied','flags.citySealReported'],
  blockedReply:'There is something to establish before that request can be considered.',retryReply:'“My answer has not changed. Bring a new observation back, and we can discuss it again.”',
  success,failure,boundary:{reply:'“No. Threats will not change that boundary.”',relationship:{trust:-1,respect:-1,fear:1},mood:'guarded',memory:'Refused an attempt to use threats to cross a stated boundary.'},...extra};
}
export function addDelversSocial(npcs,initialFlags) {
 for(const [id,personality] of Object.entries(profiles)){
  const npc=npcs[id];npc.personality=personality;npc.conversation.natural=true;
  npc.conversation.knowledge=[...(npc.conversation.publicFacts || []).map((text,index)=>({id:id+'-public-'+index,tier:'advice',subjects:[],text})),
   ...(npc.conversation.conditionalFacts || []).map((entry,index)=>({id:id+'-conditional-'+index,tier:'advice',subjects:[],...entry,text:entry.fact}))];
 }
 for(const name of ['cityLethrielAnnotationsShared','citySelkaConfidence','cityDorrikEndorsement'])initialFlags[name]=false;
 const maps=npcs['city-delvers-maps-resident'];
 npcs['city-delvers-resident'].conversation.knowledge=[
  {id:'hester-survey',tier:'advice',subjects:['work','help','survey','seal'],text:'Hester records the upper-city municipal seal survey at the junction. Visitors can bring back an observed record rather than take a relic.'},
  {id:'hester-briefing',tier:'advice',subjects:['map','maps','below','descent','ledger'],text:'The safety ledger inside the Last Lantern and the public folio at Moth & Compass both explain the maintained approach and return stair.'},
  {id:'hester-bypass',tier:'solution',subjects:['sentinel','avoid','bypass','ward'],text:'The gallery and refuge provide a route around the sentinel street.'},
  {id:'hester-reported',tier:'advice',subjects:['reported','record','seal','survey'],requires:[flag('citySealReported')],text:'Hester has received the company’s municipal-seal record and recorded their safe return.'},
 ];
 maps.conversation.knowledge=[
  {id:'maps-upper-folio',tier:'advice',subjects:['maps','map','explore','below','survey','folio'],text:'The public survey folio here covers the maintained upper streets and the return stair to Rope Landing. It is the sensible starting map for a first visit below.'},
  {id:'maps-uncertainty',tier:'advice',subjects:['maps','old drawings','accuracy','annotations'],text:'Older drawings disagree. Lethriel marks observed streets separately from uncertain annotations and recommends comparing the notes before trusting a turn.'},
  {id:'maps-working-notes',tier:'advice',subjects:['notes','private annotations','unfinished notes'],text:'Lethriel keeps unfinished working notes and is cautious about sharing them. A respectful request can open a discussion; possessing the notes is not established merely by asking.'},
  {id:'maps-deep-boundary',tier:'detail',subjects:['citadel','deeper','route'],text:'The deeper citadel is sealed; Lethriel has no confirmed route beyond that threshold.'},
  {id:'maps-gallery',tier:'detail',subjects:['directions','refuge','gallery','route'],text:'Echo Gallery leads to Surveyors’ Refuge, where a public chart describes the municipal gate.'},
  {id:'maps-ward-bypass',tier:'solution',subjects:['avoid','sentinel','bypass','ward'],text:'The gallery and refuge route avoids the sentinel on Ward Street.'},
  {id:'maps-private-annotation',tier:'detail',subjects:['private annotations','margin notes'],requires:[flag('cityLethrielAnnotationsShared')],text:'Lethriel’s private margin notes compare conflicting dates on two surveys. They are careful working notes, not a new confirmed passage.'},
 ];
 maps.socialChallenges=[challenge('lethriel-annotations',['private annotations','margin notes','working notes','unfinished notes'],{Persuasion:{dc:13},Deception:{dc:15}},'Convince Lethriel to share unfinished working notes. Failure leaves her asking for first-hand evidence; threats cannot buy her confidence.',
  {reply:'“All right. My private margin notes compare conflicting dates on two surveys. They are working notes, not proof of another passage.”',effects:[set('cityLethrielAnnotationsShared')],relationship:{trust:1,respect:1},mood:'engaged',memory:'Shared working annotations after a deliberate, successful request.'},
  {reply:'“Not yet. Bring back something you observed yourself. Then we can compare notes rather than confidence.”',relationship:{respect:-1},mood:'cautious',memory:'Declined the request for unfinished annotations and asked for first-hand evidence.'},
  {evidence:[{requires:[flag('citySealReported')],reply:'“You brought back a real survey. We can compare my working notes now.”'}]})];
 maps.socialChallenges.push(challenge('lethriel-insight',['your hesitation','lethriels intentions','read your intentions'],{Insight:{dc:12}},'Read Lethriel’s guarded manner. Insight can notice a cue, not prove whether someone is lying.',
  {reply:'Lethriel’s hesitation centres on the unfinished notes. She becomes more precise when distinguishing an observation from a guess; the cue is caution about her work, not proof of a hidden passage.',relationship:{respect:1},memory:'Noticed Lethriel’s caution about unfinished work without treating Insight as mind-reading.'},
  {reply:'Her pause is difficult to read. It does not establish whether she is hiding anything.',memory:'Could not draw a reliable conclusion from Lethriel’s manner.'},
  {retryOn:['flags.cityLethrielAnnotationsShared']}));
 npcs['city-last-host'].socialChallenges=[challenge('selka-confidence',['your own expedition story','your private story'],{Persuasion:{dc:12}},'Ask Selka to share a personal reflection rather than a guest’s private affairs.',
  {reply:'“The banners matter less to me than the ordinary voices beneath them. I keep an empty chair in mind whenever a crew goes down. That is why I fuss.”',effects:[set('citySelkaConfidence')],relationship:{trust:1},mood:'reflective',memory:'Shared a personal reflection about why returned crews matter.'},
  {reply:'“Another time. I can talk about the tavern, but I am not ready to make this a conversation about me.”',mood:'reserved',memory:'Kept her personal reflection private without ending ordinary conversation.'})];
 npcs['city-delvers-board-resident'].socialChallenges=[challenge('dorrik-endorsement',['vouch for us','vouch for our crew','endorse our crew'],{Persuasion:{dc:14}},'Seek Dorrik’s personal confidence in the crew. This is not guild membership or a paid service.',
  {reply:'“I will speak well of your care. Do not turn that into a claim of guild membership or permission to ignore the safety ledger.”',effects:[set('cityDorrikEndorsement')],relationship:{trust:1,respect:1},mood:'approving',memory:'Expressed personal confidence in the crew, without granting institutional access.'},
  {reply:'“Show me the preparation first. A checked knot and a sensible plan mean more than a fine speech.”',mood:'sceptical',memory:'Asked the crew to demonstrate preparation before endorsing its care.'},
  {retryOn:['flags.cityDelversPlanRegistered'],evidence:[{requires:[flag('cityDelversPlanRegistered')]}]})];
}
