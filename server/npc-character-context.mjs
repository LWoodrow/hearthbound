// Authored character knowledge is separate from conversation and game scores.
// This projector does not infer a biography or turn generated chat into facts.
export function characterContext(npc, personality = {}) {
 const {traits = [], values = [], interests = [], mannerisms = [], boundaries = [], bonds = [], mood} = personality;
 return {
  name:npc.name,
  role:npc.role,
  voice:npc.voice || personality.voice,
  personality:{traits,values,interests,mannerisms,boundaries,bonds,mood},
  life:npc.conversation?.life || {},
 };
}

export function conversationSources(context) {
 return {
  established:{character:context.character,place:context.place,facts:context.facts,verifiedMemories:context.verifiedMemories,practicalKnowledge:context.practicalKnowledge},
  limits:{
   personalExperience:'Only explicitly recorded personal experiences are known. No recorded visit means unknown, not never visited. A recommendation does not establish firsthand experience or another person\'s tastes.',
   perspective:'Keep the actor, recipient and relationship in each established fact. Someone teasing you is not you teasing them.',
   conversation:'Earlier replies are conversational context, not additional biography. Correct an earlier unsupported claim briefly instead of defending or repeating it.',
   expression:'Your feelings, opinions, humour and ways of phrasing things can be spontaneous. Concrete people, visits, dishes, possessions, events and world changes cannot be invented.',
   practicalDetails:'Use recorded practicalKnowledge and explicit current facts. Missing opening hours, menu items, prices, room vacancies and current service availability are unknown. A public memorial or a caretaker role does not imply shop hours. Recommend a known venue without claiming it serves a requested dish or is open, quiet or available now. Advice is not a transaction refusal.',
   confirmation:'Thanks, agreement and a follow-up question do not verify an earlier answer. If your earlier practical claim has no current source, briefly correct the uncertainty rather than repeating it as a booking, meal or other established fact.',
  },
 };
}
