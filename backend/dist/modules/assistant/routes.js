"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const rateLimit_1 = require("../../middleware/rateLimit");
const assistantNlp_1 = require("../../utils/assistantNlp");
const router = (0, express_1.Router)();
const contextSchema = zod_1.z
    .object({
    brands: zod_1.z.array(zod_1.z.string()).optional(),
    categories: zod_1.z.array(zod_1.z.string()).optional(),
    condition: zod_1.z.enum(["NEW", "USED", "REFURBISHED", "OPEN_BOX"]).optional(),
    minPrice: zod_1.z.number().optional(),
    maxPrice: zod_1.z.number().optional(),
})
    .optional();
const chatSchema = zod_1.z.object({ message: zod_1.z.string().min(1).max(500), context: contextSchema });
const ASSISTANT_PRODUCT_SELECT = {
    id: true,
    title: true,
    slug: true,
    basePrice: true,
    compareAtPrice: true,
    condition: true,
    status: true,
    description: true,
    specifications: true,
    categoryId: true,
    isFeatured: true,
    isBestSeller: true,
    brand: { select: { name: true } },
    category: { select: { name: true } },
    images: { where: { isPrimary: true }, take: 1, select: { thumbUrl: true, url: true } },
};
function formatPKR(n) {
    return `PKR ${new Intl.NumberFormat("en-US").format(Math.round(n))}`;
}
function toChatProduct(p) {
    const specs = Array.isArray(p.specifications)
        ? p.specifications.slice(0, 4).map((s) => `${s.label}: ${s.value}`)
        : [];
    return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        link: `/product/${p.slug}`,
        price: Number(p.basePrice),
        compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
        condition: p.condition,
        status: p.status,
        available: p.status === "AVAILABLE",
        brand: p.brand.name,
        category: p.category.name,
        description: p.description ? String(p.description).slice(0, 220) : null,
        specs,
        imageUrl: p.images[0]?.thumbUrl || p.images[0]?.url || null,
    };
}
function buildRecommendation(items) {
    const available = items.filter((i) => i.available);
    if (available.length === 0) {
        return "None of these are currently in stock — ask me and I can suggest similar available alternatives.";
    }
    if (available.length < items.length) {
        const unavailable = items.filter((i) => !i.available).map((i) => i.title);
        return `${available.map((i) => i.title).join(" and ")} — the best bet right now, since ${unavailable.join(", ")} ${unavailable.length === 1 ? "is" : "are"} currently unavailable.`;
    }
    const cheapest = [...available].sort((a, b) => a.price - b.price)[0];
    const priciest = [...available].sort((a, b) => b.price - a.price)[0];
    if (cheapest.id === priciest.id)
        return `${cheapest.title} is in stock and ready to go.`;
    const diff = priciest.price - cheapest.price;
    return `If budget matters most, go with ${cheapest.title} — it's ${formatPKR(diff)} cheaper. If you want the higher-end option, ${priciest.title} is the step up.`;
}
// Small phrase banks, picked at random, so the assistant doesn't repeat the
// exact same sentence on every turn — still fully deterministic/rule-based,
// just varied enough not to read like a template being filled in.
const GREETING_REPLIES = [
    "Hi! I can help you find phones or accessories — tell me a brand, a budget, or what you're after.",
    "Hello! What are you looking for — a specific brand, a price range, or just browsing what's popular?",
    "Hey there! Let me know what you need and I'll check our live stock for you.",
];
const HOW_ARE_YOU_REPLIES = [
    "Doing well, thanks for asking! What can I help you find today?",
    "All good here — ready to help you find a phone. What are you thinking?",
];
const THANKS_REPLIES = [
    "You're welcome! Let me know if you need anything else.",
    "Anytime — happy to help if you have more questions.",
    "No problem at all. Feel free to ask about anything else in stock.",
];
const FAREWELL_REPLIES = [
    "Take care! Come back anytime you want to check stock or prices.",
    "Goodbye! I'm here whenever you need help finding something.",
];
const HELP_REPLIES = [
    'I\'m VIP Mobile\'s shopping assistant — ask things like "iPhone under 100k", "cheapest Samsung phone", or "compare iPhone 13 vs Galaxy S21", and I\'ll search our real, live stock for you.',
];
const RESULT_INTROS = [
    (n, bits) => `Found ${n} option${n === 1 ? "" : "s"}${bits}, currently in stock:`,
    (n, bits) => `Here${n === 1 ? "'s" : " are"} ${n} match${n === 1 ? "" : "es"}${bits}:`,
    (n, bits) => `Take a look — ${n} in stock${bits}:`,
];
const NO_RESULTS_INTROS = [
    "I couldn't find an exact match for that, but here are some popular picks in stock right now:",
    "Nothing matched exactly — here's what's trending instead:",
    "No exact match, but you might like these:",
];
const COMPARE_INTROS = [
    (names) => `Comparing ${names}:`,
    (names) => `Here's how ${names} stack up:`,
    (names) => `Let's see how ${names} compare:`,
];
const SOLDOUT_INTROS = [
    (title, status) => `${title} is currently ${status}, but here's what's similar and available:`,
    (title, status) => `Looks like ${title} is ${status} right now — try one of these instead:`,
];
router.post("/chat", rateLimit_1.assistantLimiter, (0, validate_1.validateBody)(chatSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const message = req.body.message.trim();
    const prevContext = req.body.context ?? {};
    // --- Small talk short-circuits before any DB work, so a "hi" never
    // gets treated as a failed product search. ---
    if ((0, assistantNlp_1.isGreeting)(message))
        return void res.json({ reply: (0, assistantNlp_1.pick)(GREETING_REPLIES), context: prevContext });
    if ((0, assistantNlp_1.isHowAreYou)(message))
        return void res.json({ reply: (0, assistantNlp_1.pick)(HOW_ARE_YOU_REPLIES), context: prevContext });
    if ((0, assistantNlp_1.isThanks)(message))
        return void res.json({ reply: (0, assistantNlp_1.pick)(THANKS_REPLIES), context: prevContext });
    if ((0, assistantNlp_1.isFarewell)(message))
        return void res.json({ reply: (0, assistantNlp_1.pick)(FAREWELL_REPLIES), context: prevContext });
    if ((0, assistantNlp_1.isHelpRequest)(message))
        return void res.json({ reply: (0, assistantNlp_1.pick)(HELP_REPLIES), context: prevContext });
    const effectivePrevContext = (0, assistantNlp_1.isResetQuery)(message) ? {} : prevContext;
    const [brands, categories] = await Promise.all([
        prisma_1.prisma.brand.findMany({ select: { name: true } }),
        prisma_1.prisma.category.findMany({ select: { name: true } }),
    ]);
    const newBrandMatches = (0, assistantNlp_1.extractMatches)(message, brands.map((b) => b.name));
    const newCategoryMatches = (0, assistantNlp_1.extractMatches)(message, categories.map((c) => c.name));
    const newCondition = (0, assistantNlp_1.extractCondition)(message);
    const { minPrice: newMinPrice, maxPrice: newMaxPrice } = (0, assistantNlp_1.extractPriceRange)(message);
    const cheap = (0, assistantNlp_1.wantsCheap)(message);
    const premium = (0, assistantNlp_1.wantsPremium)(message);
    const bareFollowUp = (0, assistantNlp_1.isBareFollowUp)(message);
    // Merge: whatever this message explicitly mentions wins; anything it
    // doesn't carries forward from the previous turn — this is what lets
    // "iPhones under 100k" followed by "cheaper ones?" or "what about used"
    // work as a refinement instead of a brand-new, context-free search.
    const matchedBrands = newBrandMatches.length ? newBrandMatches : effectivePrevContext.brands ?? [];
    const matchedCategories = newCategoryMatches.length ? newCategoryMatches : effectivePrevContext.categories ?? [];
    const condition = newCondition ?? effectivePrevContext.condition;
    const minPrice = newMinPrice ?? effectivePrevContext.minPrice;
    const maxPrice = newMaxPrice ?? effectivePrevContext.maxPrice;
    const nextContext = { brands: matchedBrands, categories: matchedCategories, condition, minPrice, maxPrice };
    // --- Comparison: "compare X vs Y", "X or Y", "difference between X and Y" ---
    if ((0, assistantNlp_1.isComparisonQuery)(message)) {
        const phrases = (0, assistantNlp_1.splitComparisonPhrases)(message);
        const resolved = [];
        for (const phrase of phrases.slice(0, 4)) {
            if (phrase.length < 2)
                continue;
            const found = await prisma_1.prisma.product.findFirst({
                where: { title: { contains: phrase } },
                select: ASSISTANT_PRODUCT_SELECT,
                orderBy: { createdAt: "desc" },
            });
            if (found && !resolved.some((r) => r.id === found.id))
                resolved.push(found);
        }
        if (resolved.length >= 2) {
            const items = resolved.map(toChatProduct);
            res.json({
                reply: (0, assistantNlp_1.pick)(COMPARE_INTROS)(items.map((i) => i.title).join(" and ")),
                products: items,
                recommendation: buildRecommendation(items),
                context: nextContext,
            });
            return;
        }
        // Couldn't resolve two real products from the phrasing — fall through to a normal search.
    }
    // --- A specific, named product ("is the iPhone 13 available?") — only when
    // THIS message alone looks like a product name, not a filter query or a
    // bare "yes"/"more" continuation of the previous turn. ---
    if (!bareFollowUp &&
        !newBrandMatches.length &&
        !newCategoryMatches.length &&
        newMinPrice == null &&
        newMaxPrice == null &&
        message.length > 2) {
        const found = await prisma_1.prisma.product.findFirst({
            where: { title: { contains: message } },
            select: ASSISTANT_PRODUCT_SELECT,
        });
        if (found) {
            const item = toChatProduct(found);
            if (!item.available) {
                const alternatives = await prisma_1.prisma.product.findMany({
                    where: { id: { not: found.id }, categoryId: found.categoryId, status: { in: ["AVAILABLE", "RESERVED"] } },
                    select: ASSISTANT_PRODUCT_SELECT,
                    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
                    take: 4,
                });
                res.json({
                    reply: (0, assistantNlp_1.pick)(SOLDOUT_INTROS)(item.title, item.status === "SOLD" ? "sold out" : "unavailable"),
                    products: alternatives.map(toChatProduct),
                    unavailableProduct: item,
                    context: nextContext,
                });
                return;
            }
            res.json({ reply: `Here's what I found for "${found.title}":`, products: [item], context: nextContext });
            return;
        }
    }
    // --- General filtered search, using the merged (new + carried-forward) filters ---
    const where = { status: { in: ["AVAILABLE", "RESERVED"] } };
    if (matchedBrands.length)
        where.brand = { name: { in: matchedBrands } };
    if (matchedCategories.length)
        where.category = { name: { in: matchedCategories } };
    if (condition)
        where.condition = condition;
    if (minPrice != null || maxPrice != null) {
        where.basePrice = { ...(minPrice != null ? { gte: minPrice } : {}), ...(maxPrice != null ? { lte: maxPrice } : {}) };
    }
    const orderBy = cheap
        ? [{ basePrice: "asc" }]
        : premium
            ? [{ basePrice: "desc" }]
            : [{ isFeatured: "desc" }, { isBestSeller: "desc" }, { createdAt: "desc" }];
    let matches = await prisma_1.prisma.product.findMany({ where, select: ASSISTANT_PRODUCT_SELECT, orderBy, take: 6 });
    let reply;
    if (matches.length === 0) {
        matches = await prisma_1.prisma.product.findMany({
            where: { status: { in: ["AVAILABLE", "RESERVED"] } },
            select: ASSISTANT_PRODUCT_SELECT,
            orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
            take: 4,
        });
        reply = (0, assistantNlp_1.pick)(NO_RESULTS_INTROS);
    }
    else {
        const bits = [];
        if (matchedBrands.length)
            bits.push(matchedBrands.join("/"));
        if (matchedCategories.length)
            bits.push(matchedCategories.join("/"));
        if (condition)
            bits.push(condition.toLowerCase().replace("_", " "));
        if (minPrice != null && maxPrice != null)
            bits.push(`between ${formatPKR(minPrice)} and ${formatPKR(maxPrice)}`);
        else if (maxPrice != null)
            bits.push(`under ${formatPKR(maxPrice)}`);
        else if (minPrice != null)
            bits.push(`above ${formatPKR(minPrice)}`);
        reply = (0, assistantNlp_1.pick)(RESULT_INTROS)(matches.length, bits.length ? ` matching ${bits.join(", ")}` : "");
    }
    res.json({ reply, products: matches.map(toChatProduct), context: nextContext });
}));
exports.default = router;
