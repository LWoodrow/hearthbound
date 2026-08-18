const TERMINAL_CONTROL_TOKENS = /\}?\s*(?:<\/?(?:think|s|assistant|user|system|tool)>\s*)+$/gi;

export function sanitizeModelText(value) {
  return String(value || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(TERMINAL_CONTROL_TOKENS, "")
    .replace(/<\/?(?:think|s|assistant|user|system|tool)>/gi, "")
    .trim();
}

function sanitizeModelValue(value) {
  if (typeof value === "string") return sanitizeModelText(value);
  if (Array.isArray(value)) return value.map(sanitizeModelValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeModelValue(item)]));
  }
  return value;
}

export function parseModelJson(value) {
  const cleaned = String(value || "")
    .replace(/^\s*(?:<think>[\s\S]*?<\/think>\s*)+/i, "")
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .replace(/\s*(?:<\/?(?:think|s|assistant|user|system|tool)>\s*)+$/gi, "")
    .trim();
  try {
    return sanitizeModelValue(JSON.parse(cleaned));
  } catch (originalError) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return sanitizeModelValue(JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)));
    }
    throw originalError;
  }
}
