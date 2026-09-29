export const normaliseText = (value) => String(value || "").toLowerCase()
  .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export const textTokens = (value) => normaliseText(value).split(" ").filter(Boolean);

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
