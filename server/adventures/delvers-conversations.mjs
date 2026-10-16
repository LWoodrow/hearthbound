// Everyday life is authored setting, not a simulated clock or a generated quest.
const localLife={
 'city-delvers-rope-resident':[
  '“Half my visitors want the cleverest knot in the city. The other half want me to undo it. I keep the practice pit padded for both sorts.”',
  '“Lethriel and Ysra argue about old street names. I label rope by length. There is much less room for a scholarly dispute.”',
  '“A bowline is satisfying because you can see why it holds. I like work that lets the next person check mine.”'],
 'city-delvers-maps-resident':[
  '“The surveyors cannot agree whether to label the buried streets by their old names or the buildings above them. I keep both on my maps. Getting lost is not improved by winning an argument.”',
  '“Tavi teaches knots across the square, while Dorrik keeps the departure and return register. Different trades, same concern: getting people back upstairs. Nima has the quieter version of that conversation at the Wall.”',
  '“I enjoy the corrections more than the finished map. A rubbed-out line means somebody went back, looked properly, and admitted they had been wrong.”'],
 'city-delvers-board-resident':[
  '“Returned crews disagree about distances, street names and whose idea the expedition was. They generally agree when it is time to find a table at Selka’s.”',
  '“Hester wants a record of the municipal seal, not a souvenir chipped out of it. A small distinction that saves a surprising amount of paperwork.”',
  '“I keep the return slips beside the departure notices. Otherwise the board starts looking like a collection of people leaving instead of people coming home.”'],
 'city-delvers-memorial-resident':[
  '“This is not only a wall for solemn occasions. People stop to read, talk quietly, or remember a crew they once knew. I like it when they bring their ordinary voices.”',
  '“The hostel keeps a public return board. Fen deals with notices; I look after promises. Neither is improved by boasting.”',
  '“Polishing the brass gives my hands something to do while people find their words. There is no need to hurry them.”'],
 'city-delvers-gear-resident':[
  '“Expedition crews have strong opinions about shields. Ask who checked the straps and the conversation gets much shorter.”',
  '“Tavi has the rope practice and Lethriel has the route folio. I cover the unglamorous business of straps and lights. Between us, we try to make preparation less heroic than a rescue.”',
  '“I mend my own apron because it fits. New and better are not always the same thing.”'],
 'city-delvers-hostel-resident':[
  '“The court smells of drying cloaks, and returned crews can make an ordinary staircase sound like a duel with a dragon. I listen, then ask whether everybody came back.”',
  '“There is a public return board here if you want your intended approach written down. Over at the Last Lantern, Selka keeps the expedition tables welcoming.”',
  '“I like people once they have stopped trying to impress each other. Give them a quiet conversation and most of the armour comes off, figuratively speaking.”'],
 'city-delvers-guild-resident':[
  '“We compare drawings here, which is a polite way of saying we disagree in ink. Lethriel preserves the old and new names together. I think that is sensible.”',
  '“Hester is collecting the upper survey’s municipal-seal record. It is a piece of civic history, not a warrant to force the deeper citadel open.”',
  '“Cities leave their habits in the stones. I enjoy finding the bits a grand official history thought too ordinary to mention.”'],
 'city-last-host':[
  '“The expedition banners never match, the tables are scarred, and nobody tells a short story on the first attempt. I would worry if the place ever became respectable.”',
  '“There is life outside the shaft, you know. Tavi has rope practice, Lethriel has maps, and Fen has a drying court full of wet-cloak conversations.”',
  '“I like the moment a crew stops talking about what it survived and starts talking about tomorrow’s breakfast. That is when they are properly back.”'],
 'city-delvers-resident':[
  '“The quarter runs on practical disagreements. Tavi checks knots, Lethriel checks drawings, and Dorrik checks whether anybody remembered to register. I check the return column.”',
  '“There is an upper survey to record, not a race to the bottom. Nima’s Wall and Fen’s return board are good reminders of the difference.”',
  '“I would rather hear an ordinary account from a whole crew than a magnificent account from the only person who returned.”'],
};

const greetings={
 'city-delvers-rope-resident':'“Hello! You can watch, or try the practice line. Nobody learns a knot by looking solemnly at a coil of rope.”',
 'city-delvers-maps-resident':'“Hello. Mind the curling edge of that map; it has a determined streak. Are you exploring the quarter, or looking into the old streets?”',
 'city-delvers-board-resident':'“Hello. If you have come to talk rather than file something, that makes a pleasant change.”',
 'city-delvers-memorial-resident':'“Hello. No need to lower your voice on my account. You are welcome to stop a while.”',
 'city-delvers-gear-resident':'“Hello there. Looking over the display, or taking a breather from the square?”',
 'city-delvers-hostel-resident':'“Welcome. There is always room for a conversation in the court, even when the boot racks disagree.”',
 'city-delvers-guild-resident':'“Hello. You need not be a member to ask a question. What has caught your curiosity?”',
 'city-last-host':'“Hello again. A question, a story, or simply a moment away from the shaft?”',
 'city-delvers-resident':'“Hello. No form required for a conversation. What is on your mind?”',
};
const returns={
 'city-delvers-rope-resident':'“Hester has your seal report. The important knot is the one that brings the whole account back upstairs, if you will forgive a ropeworker’s metaphor.”',
 'city-delvers-maps-resident':'“Your municipal-seal report is in Hester’s register. That is the sort of evidence a map ought to rest on: something observed and brought back, not a confident guess.”',
 'city-delvers-board-resident':'“Your seal report is in Hester’s register. A completed return makes a far better entry than an impressive departure.”',
 'city-delvers-memorial-resident':'“Hester has recorded your survey and safe return. I am glad that is an ordinary conversation we get to have.”',
 'city-delvers-gear-resident':'“The seal report is back with Hester, and so are you. Better than any story about how much equipment a person can carry.”',
 'city-delvers-hostel-resident':'“Hester has your report. Good to hear a journey with an upstairs ending; they are my favourite kind.”',
 'city-delvers-guild-resident':'“Your seal is reported to Hester. We can compare the survey record here when you are ready; the public rebuilding records give it some useful company.”',
 'city-last-host':'“Your seal survey is in Hester’s register. I much prefer talking about a returned expedition to watching an empty chair.”',
 'city-delvers-resident':'“Your seal record is safely in the register. A small piece of the city’s past, brought back without breaking it. That is worthwhile work.”',
};
export function addDelversConversations(npcs) {
 for(const [id,[first,second,personal]] of Object.entries(localLife)){
  const npc=npcs[id];
  npc.conversation.topics=[
   {id:id+'-greeting',kind:'greeting',text:greetings[id]},
   {id:id+'-returned',kind:'local-news',requires:[{path:'flags.citySealReported',equals:true}],text:returns[id]},
   {id:id+'-news-one',kind:'local-news',text:first},
   {id:id+'-news-two',kind:'local-news',text:second,...(['city-delvers-resident','city-delvers-board-resident','city-delvers-guild-resident'].includes(id)?{requires:[{path:'flags.citySealReported',equals:false}]}:{})},
   {id:id+'-personal',kind:'personal',text:personal},
  ];
 }
}
