export const normaliseText = (value) => String(value || "").toLowerCase()
  .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export const textTokens = (value) => normaliseText(value).split(" ").filter(Boolean);

// Normalize command shorthand, not entity names or player-visible speech.
// This is deliberately lexical: no guessed destination, fuzzy noun match,
// missing precondition or mode change is inferred.
export const normaliseActionText = (value) => normaliseText(value).replace(/\bgoto\b/g,"go to");

export function asksAboutNearbyPeople(value) {
  const words=normaliseText(value);
  return /\b(who|anyone|anybody|people|person|persons|occupants?|staff|innkeeper|keeper)\b/.test(words)
    && /^(?:(?:are|is) there|who\b|any\b|anyone\b|anybody\b|(?:do|can) (?:i|we) see|people\b)/.test(words)
    && /\b(here|around|nearby|present|inside|in)\b/.test(words);
}
export const isGreeting=(value)=>/^(?:hello|hi|hey|greetings|good morning|good afternoon|good evening)(?: everyone| everybody| there| all)?$/.test(normaliseText(value));

// Short nouns (key, ink, map, Ada) still identify entities. Function words
// don't: a scene-local exact tie must ask rather than choose the first match.
const REFERENCE_STOP_WORDS = new Set(["the","and","for","with","from","into","that","this","them","some","somewhere","thing","things","place","places","area","areas","room","rooms","please","you","your","our","can","could","would","get","look","take","use","open","move","go","to","of","in","on","at","a","an","is","it","me","we","us"]);
export const meaningfulReferenceWords = (value) => textTokens(value).filter((word) => word.length >= 3 && !REFERENCE_STOP_WORDS.has(word));

// Small, predictable English inflections suffice for scene names without
// importing model guesses or broad fuzzy matching into authoritative rules.
export function tokenForms(token) {
  const value = normaliseText(token);
  const forms = new Set([value]);
  if (value.endsWith("ies") && value.length > 4) forms.add(`${value.slice(0, -3)}y`);
  if (value.endsWith("es") && value.length > 4) forms.add(value.slice(0, -2));
  if (value.endsWith("s") && value.length > 3) forms.add(value.slice(0, -1));
  if (value.endsWith("ed") && value.length > 4) {
    forms.add(value.slice(0, -2));
    forms.add(value.slice(0, -1));
  }
  if (value.endsWith("ing") && value.length > 5) {
    forms.add(value.slice(0, -3));
    forms.add(`${value.slice(0, -3)}e`);
  }
  return forms;
}

export function tokenEquivalent(left, right) {
  const a = tokenForms(left);
  return [...tokenForms(right)].some((form) => a.has(form));
}

export function phraseOverlap(action, phrase, ignored = new Set()) {
  const source = textTokens(action);
  const target = textTokens(phrase).filter((word) => word.length >= 4 && !ignored.has(word));
  if (!target.length) return { overlap:0, total:0, head:false };
  const overlap = target.filter((word) => source.some((item) => tokenEquivalent(item, word))).length;
  return { overlap, total:target.length, head:source.some((item) => tokenEquivalent(item, target.at(-1))) };
}
