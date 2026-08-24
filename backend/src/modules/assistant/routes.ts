import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { assistantLimiter } from "../../middleware/rateLimit";
import {
  extractPriceRange,
  extractCondition,
  extractMatches,
  isComparisonQuery,
  splitComparisonPhrases,
  wantsCheap,
  wantsPremium,
} from "../../utils/assistantNlp";

const router = Router();

const chatSchema = z.object({ message: z.string().min(1).max(500) });

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
} satisfies Prisma.ProductSelect;

type AssistantProduct = Prisma.ProductGetPayload<{ select: typeof ASSISTANT_PRODUCT_SELECT }>;

function formatPKR(n: number): string {
  return `PKR ${new Intl.NumberFormat("en-US").format(Math.round(n))}`;
}

function toChatProduct(p: AssistantProduct) {
  const specs = Array.isArray(p.specifications)
    ? (p.specifications as any[]).slice(0, 4).map((s) => `${s.label}: ${s.value}`)
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

type ChatProduct = ReturnType<typeof toChatProduct>;

function buildRecommendation(items: ChatProduct[]): string {
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
  if (cheapest.id === priciest.id) return `${cheapest.title} is in stock and ready to go.`;
  const diff = priciest.price - cheapest.price;
  return `If budget matters most, go with ${cheapest.title} — it's ${formatPKR(diff)} cheaper. If you want the higher-end option, ${priciest.title} is the step up.`;
}

router.post(
  "/chat",
  assistantLimiter,
  validateBody(chatSchema),
  asyncHandler(async (req, res) => {
    const message: string = req.body.message.trim();

    const [brands, categories] = await Promise.all([
      prisma.brand.findMany({ select: { name: true } }),
      prisma.category.findMany({ select: { name: true } }),
    ]);
    const matchedBrands = extractMatches(message, brands.map((b) => b.name));
    const matchedCategories = extractMatches(message, categories.map((c) => c.name));
    const condition = extractCondition(message);
    const { minPrice, maxPrice } = extractPriceRange(message);
    const cheap = wantsCheap(message);
    const premium = wantsPremium(message);

    // --- Comparison: "compare X vs Y", "X or Y", "difference between X and Y" ---
    if (isComparisonQuery(message)) {
      const phrases = splitComparisonPhrases(message);
      const resolved: AssistantProduct[] = [];
      for (const phrase of phrases.slice(0, 4)) {
        if (phrase.length < 2) continue;
        const found = await prisma.product.findFirst({
          where: { title: { contains: phrase } },
          select: ASSISTANT_PRODUCT_SELECT,
          orderBy: { createdAt: "desc" },
        });
        if (found && !resolved.some((r) => r.id === found.id)) resolved.push(found);
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
      const found = await prisma.product.findFirst({
        where: { title: { contains: message } },
        select: ASSISTANT_PRODUCT_SELECT,
      });
      if (found) {
        const item = toChatProduct(found);
        if (!item.available) {
          const alternatives = await prisma.product.findMany({
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
    const where: Prisma.ProductWhereInput = { status: { in: ["AVAILABLE", "RESERVED"] } };
    if (matchedBrands.length) where.brand = { name: { in: matchedBrands } };
    if (matchedCategories.length) where.category = { name: { in: matchedCategories } };
    if (condition) where.condition = condition;
    if (minPrice != null || maxPrice != null) {
      where.basePrice = { ...(minPrice != null ? { gte: minPrice } : {}), ...(maxPrice != null ? { lte: maxPrice } : {}) };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = cheap
      ? [{ basePrice: "asc" }]
      : premium
      ? [{ basePrice: "desc" }]
      : [{ isFeatured: "desc" }, { isBestSeller: "desc" }, { createdAt: "desc" }];

    let matches = await prisma.product.findMany({ where, select: ASSISTANT_PRODUCT_SELECT, orderBy, take: 6 });

    let reply: string;
    if (matches.length === 0) {
      matches = await prisma.product.findMany({
        where: { status: { in: ["AVAILABLE", "RESERVED"] } },
        select: ASSISTANT_PRODUCT_SELECT,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        take: 4,
      });
      reply = "I couldn't find anything matching that exactly, but here are some popular picks currently in stock:";
    } else {
      const bits: string[] = [];
      if (matchedBrands.length) bits.push(matchedBrands.join("/"));
      if (matchedCategories.length) bits.push(matchedCategories.join("/"));
      if (condition) bits.push(condition.toLowerCase().replace("_", " "));
      if (minPrice != null && maxPrice != null) bits.push(`between ${formatPKR(minPrice)} and ${formatPKR(maxPrice)}`);
      else if (maxPrice != null) bits.push(`under ${formatPKR(maxPrice)}`);
      else if (minPrice != null) bits.push(`above ${formatPKR(minPrice)}`);
      reply = `I found ${matches.length} ${matches.length === 1 ? "product" : "products"}${bits.length ? ` matching ${bits.join(", ")}` : ""} currently in stock:`;
    }

    res.json({ reply, products: matches.map(toChatProduct) });
  })
);

export default router;
