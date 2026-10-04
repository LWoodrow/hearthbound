import {isGreeting} from "./semantic-tokens.mjs";

// Only used after named/hearable NPC conversation has had first refusal.
// Anonymous scene activity cannot become a new NPC, offer or quest outcome.
export function unansweredSpeech(definition,world,name,action) {
  const location=definition?.locations?.[world?.currentLocation];
  if(isGreeting(action)) {
    if(location?.occupants?.length&&location.ambientGreeting) return name+" greets the people nearby. "+location.ambientGreeting;
    return name+" calls a greeting into the surroundings. No reply is established.";
  }
  return name+" says this aloud. No response is established; the company remains where it is.";
}
