"use strict";
// Rule-based intent extraction for the shopping assistant — no external AI
// API, just regex/keyword parsing over the user's message plus lookups
// against our own Brand/Category/Product tables. Deliberately simple and
// explainable rather than statistical: good enough to catch "iPhone under
// 100k", "compare X vs Y", "cheapest Samsung phone" without any model to
// host or pay for.
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPriceRange = extractPriceRange;
exports.extractCondition = extractCondition;
exports.extractMatches = extractMatches;
exports.isComparisonQuery = isComparisonQuery;
exports.splitComparisonPhrases = splitComparisonPhrases;
exports.wantsCheap = wantsCheap;
exports.wantsPremium = wantsPremium;
const AMOUNT = "([\\d,]+(?:\\.\\d+)?\\s*(?:k|lakh|lac)?)";
function parseAmount(raw) {
    const cleaned = raw.replace(/,/g, "").trim().toLowerCase();
    const lakh = cleaned.match(/^([\d.]+)\s*(lakh|lac)$/);
    if (lakh)
        return Math.round(parseFloat(lakh[1]) * 100000);
    const k = cleaned.match(/^([\d.]+)\s*k$/);
    if (k)
        return Math.round(parseFloat(k[1]) * 1000);
    return parseFloat(cleaned);
}
function extractPriceRange(text) {
    const t = text.toLowerCase();
    const between = t.match(new RegExp(`between\\s+${AMOUNT}\\s+(?:and|to|-)\\s+${AMOUNT}`, "i"));
    if (between) {
        const a = parseAmount(between[1]);
        const b = parseAmount(between[2]);
        if (Number.isFinite(a) && Number.isFinite(b))
            return { minPrice: Math.min(a, b), maxPrice: Math.max(a, b) };
    }
    const under = t.match(new RegExp(`(?:under|below|less than|up ?to|within|max(?:imum)?)\\s+${AMOUNT}`, "i"));
    if (under) {
        const v = parseAmount(under[1]);
        if (Number.isFinite(v))
            return { maxPrice: v };
    }
    const over = t.match(new RegExp(`(?:above|over|more than|starting from|min(?:imum)?)\\s+${AMOUNT}`, "i"));
    if (over) {
        const v = parseAmount(over[1]);
        if (Number.isFinite(v))
            return { minPrice: v };
    }
    const around = t.match(new RegExp(`(?:around|approximately|about|near)\\s+${AMOUNT}`, "i"));
    if (around) {
        const v = parseAmount(around[1]);
        if (Number.isFinite(v))
            return { minPrice: Math.round(v * 0.8), maxPrice: Math.round(v * 1.2) };
    }
    return {};
}
function extractCondition(text) {
    const t = text.toLowerCase();
    if (/\brefurbished\b/.test(t))
        return "REFURBISHED";
    if (/\bopen[\s-]?box\b/.test(t))
        return "OPEN_BOX";
    if (/\bused\b|\bsecond[\s-]?hand\b/.test(t))
        return "USED";
    if (/\bbrand[\s-]?new\b|\bnew\b/.test(t))
        return "NEW";
    return undefined;
}
/** Case-insensitive substring match of known names (brands/categories) against free text. */
function extractMatches(text, names) {
    const t = text.toLowerCase();
    return names.filter((n) => n.trim().length > 1 && t.includes(n.toLowerCase()));
}
function isComparisonQuery(text) {
    return /\bcompare\b|\bcomparison\b|\bvs\.?\b|\bversus\b|better than|difference between/i.test(text);
}
/** Splits a comparison-style message into candidate product-name fragments. */
function splitComparisonPhrases(text) {
    return text
        .replace(/compare|comparison|difference between|which is better|better than|please|and specs|specs/gi, "")
        .split(/\bvs\.?\b|\bversus\b|\band\b|,|\bor\b/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 1);
}
function wantsCheap(text) {
    return /\bcheap(est)?\b|\bbudget\b|\baffordable\b|\blow[\s-]?cost\b/i.test(text);
}
function wantsPremium(text) {
    return /\bpremium\b|\bbest\b|\bflagship\b|\btop[\s-]?end\b|\bhigh[\s-]?end\b|\bexpensive\b/i.test(text);
}
