// Rule-based intent extraction for the shopping assistant — no external AI
// API, just regex/keyword parsing over the user's message plus lookups
// against our own Brand/Category/Product tables. Deliberately simple and
// explainable rather than statistical: good enough to catch "iPhone under
// 100k", "compare X vs Y", "cheapest Samsung phone" without any model to
// host or pay for.

const AMOUNT = "([\\d,]+(?:\\.\\d+)?\\s*(?:k|lakh|lac)?)";

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/,/g, "").trim().toLowerCase();
  const lakh = cleaned.match(/^([\d.]+)\s*(lakh|lac)$/);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100000);
  const k = cleaned.match(/^([\d.]+)\s*k$/);
  if (k) return Math.round(parseFloat(k[1]) * 1000);
  return parseFloat(cleaned);
}

export function extractPriceRange(text: string): { minPrice?: number; maxPrice?: number } {
  const t = text.toLowerCase();

  const between = t.match(new RegExp(`between\\s+${AMOUNT}\\s+(?:and|to|-)\\s+${AMOUNT}`, "i"));
  if (between) {
    const a = parseAmount(between[1]);
    const b = parseAmount(between[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) return { minPrice: Math.min(a, b), maxPrice: Math.max(a, b) };
  }

  const under = t.match(new RegExp(`(?:under|below|less than|up ?to|within|max(?:imum)?)\\s+${AMOUNT}`, "i"));
  if (under) {
    const v = parseAmount(under[1]);
    if (Number.isFinite(v)) return { maxPrice: v };
  }

  const over = t.match(new RegExp(`(?:above|over|more than|starting from|min(?:imum)?)\\s+${AMOUNT}`, "i"));
  if (over) {
    const v = parseAmount(over[1]);
    if (Number.isFinite(v)) return { minPrice: v };
  }

  const around = t.match(new RegExp(`(?:around|approximately|about|near)\\s+${AMOUNT}`, "i"));
  if (around) {
    const v = parseAmount(around[1]);
    if (Number.isFinite(v)) return { minPrice: Math.round(v * 0.8), maxPrice: Math.round(v * 1.2) };
  }

  return {};
}

export function extractCondition(text: string): "NEW" | "USED" | "REFURBISHED" | "OPEN_BOX" | undefined {
  const t = text.toLowerCase();
  if (/\brefurbished\b/.test(t)) return "REFURBISHED";
  if (/\bopen[\s-]?box\b/.test(t)) return "OPEN_BOX";
  if (/\bused\b|\bsecond[\s-]?hand\b/.test(t)) return "USED";
  if (/\bbrand[\s-]?new\b|\bnew\b/.test(t)) return "NEW";
  return undefined;
}

/** Case-insensitive substring match of known names (brands/categories) against free text. */
export function extractMatches(text: string, names: string[]): string[] {
  const t = text.toLowerCase();
  return names.filter((n) => n.trim().length > 1 && t.includes(n.toLowerCase()));
}

export function isComparisonQuery(text: string): boolean {
  return /\bcompare\b|\bcomparison\b|\bvs\.?\b|\bversus\b|better than|difference between/i.test(text);
}

/** Splits a comparison-style message into candidate product-name fragments. */
export function splitComparisonPhrases(text: string): string[] {
  return text
    .replace(/compare|comparison|difference between|which is better|better than|please|and specs|specs/gi, "")
    .split(/\bvs\.?\b|\bversus\b|\band\b|,|\bor\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export function wantsCheap(text: string): boolean {
  return /\bcheap(est)?\b|\bbudget\b|\baffordable\b|\blow[\s-]?cost\b/i.test(text);
}

export function wantsPremium(text: string): boolean {
  return /\bpremium\b|\bbest\b|\bflagship\b|\btop[\s-]?end\b|\bhigh[\s-]?end\b|\bexpensive\b/i.test(text);
}

// --- Small talk: catching greetings/thanks/goodbyes before they fall through
// to a product search (and produce a confusing "no results for hi") is most
// of what separates a chatbot that feels responsive from one that feels
// literal. Includes common Roman-Urdu phrasing too, since VIP Mobile's
// customers write in both.

export function isGreeting(text: string): boolean {
  return /^\s*(hi+|hello+|hey+|salam|assalam.?o.?alaikum|asalam.?o.?alaikum|good\s?(morning|afternoon|evening))\b/i.test(
    text.trim()
  );
}

export function isHowAreYou(text: string): boolean {
  return /\bhow are you\b|\bhow('?s| is) it going\b|\bkaise ho\b|\bkya hal hai\b/i.test(text);
}

export function isThanks(text: string): boolean {
  return /\b(thanks|thank you|thankyou|thnx|ty|shukriya|jazakallah)\b/i.test(text);
}

export function isFarewell(text: string): boolean {
  return /\b(bye|goodbye|see you|good ?night|khuda ?hafiz|allah ?hafiz)\b/i.test(text);
}

export function isHelpRequest(text: string): boolean {
  return /\bwhat can you do\b|\bhow (do|does) (this|it|you) work\b|\bwho are you\b|^\s*help\s*$/i.test(text);
}

/** True when the message is a short, contentless follow-up ("more", "show more", "ok", "anything else") — a cue to keep the prior turn's filters rather than treat it as a fresh, unrelated query. */
export function isBareFollowUp(text: string): boolean {
  return /^\s*(more|show me more|any(thing)? (else|cheaper|other)|others?|next|continue|yes|ok(ay)?|sure)\s*\??\s*$/i.test(
    text.trim()
  );
}

/** True when the user is explicitly starting over — clears any carried-over context instead of merging with it. */
export function isResetQuery(text: string): boolean {
  return /\bnever ?mind\b|\bstart over\b|\bsomething else\b|\bforget (that|it)\b|\binstead\b/i.test(text);
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
