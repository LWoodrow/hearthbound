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
  established:{character:context.character,place:context.place,facts:context.facts,verifiedMemories:context.verifiedMemories},
  limits:{
   personalExperience:'Only explicitly recorded personal experiences are known. No recorded visit means unknown, not never visited. A recommendation does not establish firsthand experience or another person\'s tastes.',
   perspective:'Keep the actor, recipient and relationship in each established fact. Someone teasing you is not you teasing them.',
   conversation:'Earlier replies are conversational context, not additional biography. Correct an earlier unsupported claim briefly instead of defending or repeating it.',
   expression:'Your feelings, opinions, humour and ways of phrasing things can be spontaneous. Concrete people, visits, dishes, possessions, events and world changes cannot be invented.',
  },
 };
}
