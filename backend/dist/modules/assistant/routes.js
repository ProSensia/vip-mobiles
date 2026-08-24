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
const chatSchema = zod_1.z.object({ message: zod_1.z.string().min(1).max(500) });
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
router.post("/chat", rateLimit_1.assistantLimiter, (0, validate_1.validateBody)(chatSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const message = req.body.message.trim();
    const [brands, categories] = await Promise.all([
        prisma_1.prisma.brand.findMany({ select: { name: true } }),
        prisma_1.prisma.category.findMany({ select: { name: true } }),
    ]);
    const matchedBrands = (0, assistantNlp_1.extractMatches)(message, brands.map((b) => b.name));
    const matchedCategories = (0, assistantNlp_1.extractMatches)(message, categories.map((c) => c.name));
    const condition = (0, assistantNlp_1.extractCondition)(message);
    const { minPrice, maxPrice } = (0, assistantNlp_1.extractPriceRange)(message);
    const cheap = (0, assistantNlp_1.wantsCheap)(message);
    const premium = (0, assistantNlp_1.wantsPremium)(message);
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
                reply: `Here's how ${items.map((i) => i.title).join(" and ")} compare:`,
                products: items,
                recommendation: buildRecommendation(items),
            });
            return;
        }
        // Couldn't resolve two real products from the phrasing — fall through to a normal search.
    }
    // --- A specific, named product ("is the iPhone 13 available?") when no broad filter was detected ---
    if (!matchedBrands.length && !matchedCategories.length && minPrice == null && maxPrice == null && message.length > 2) {
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
                    reply: `${item.title} is currently ${item.status === "SOLD" ? "sold out" : "unavailable"}. Here are similar options in stock:`,
                    products: alternatives.map(toChatProduct),
                    unavailableProduct: item,
                });
                return;
            }
            res.json({ reply: `Here's what I found for "${found.title}":`, products: [item] });
            return;
        }
    }
    // --- General filtered search ---
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
        reply = "I couldn't find anything matching that exactly, but here are some popular picks currently in stock:";
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
        reply = `I found ${matches.length} ${matches.length === 1 ? "product" : "products"}${bits.length ? ` matching ${bits.join(", ")}` : ""} currently in stock:`;
    }
    res.json({ reply, products: matches.map(toChatProduct) });
}));
exports.default = router;
