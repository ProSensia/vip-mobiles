export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

export function formatCurrency(amount: number | string, currency = "PKR"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(value)) return `${currency} 0`;
  return `${currency} ${new Intl.NumberFormat("en-US").format(value)}`;
}

export type StockLevel = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "RESERVED";

const LOW_STOCK_THRESHOLD = 3;

export interface BadgeableProduct {
  status: string;
  basePrice: number | string;
  compareAtPrice?: number | string | null;
  isNewArrival?: boolean;
  isTrending?: boolean;
  isBestSeller?: boolean;
  isPtaApproved?: boolean;
  variants?: Array<{ stockQty: number }>;
}

// Single source of truth for stock/discount badge logic — the storefront
// (product cards, product page) and the social post generator both need
// the exact same "is this a hot deal / low stock / new arrival" answer for
// a given product, so it's defined once here rather than duplicated in the
// frontend and backend.
export function computeStockLevel(product: BadgeableProduct): StockLevel {
  if (product.status === "SOLD" || product.status === "HIDDEN") return "OUT_OF_STOCK";
  if (product.status === "RESERVED") return "RESERVED";
  if (product.variants && product.variants.length > 0) {
    const total = product.variants.reduce((sum, v) => sum + (v.stockQty ?? 0), 0);
    if (total <= 0) return "OUT_OF_STOCK";
    if (total <= LOW_STOCK_THRESHOLD) return "LOW_STOCK";
  }
  return "IN_STOCK";
}

export function computeDiscountPercent(product: BadgeableProduct): number | null {
  const base = typeof product.basePrice === "string" ? Number(product.basePrice) : product.basePrice;
  const compareAt = product.compareAtPrice
    ? typeof product.compareAtPrice === "string"
      ? Number(product.compareAtPrice)
      : product.compareAtPrice
    : null;
  if (!compareAt || compareAt <= base) return null;
  return Math.round(((compareAt - base) / compareAt) * 100);
}

/** Extracts a normalized video id/embed info from a YouTube, TikTok or Instagram URL. */
export function parseSocialVideoUrl(url: string): {
  platform: "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | null;
  embedId: string | null;
} {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").pop() ?? null;
      return { platform: "YOUTUBE", embedId: id };
    }
    if (host === "youtu.be") {
      return { platform: "YOUTUBE", embedId: u.pathname.replace("/", "") || null };
    }
    if (host === "tiktok.com") {
      const match = u.pathname.match(/\/video\/(\d+)/);
      return { platform: "TIKTOK", embedId: match ? match[1] : null };
    }
    if (host === "instagram.com") {
      const match = u.pathname.match(/\/(reel|p)\/([^/]+)/);
      return { platform: "INSTAGRAM", embedId: match ? match[2] : null };
    }
    return { platform: null, embedId: null };
  } catch {
    return { platform: null, embedId: null };
  }
}
