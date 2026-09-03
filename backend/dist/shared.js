"use strict";
// Self-contained copy of packages/shared/src/*.ts — duplicated here (not an
// npm/workspace dependency) so this app installs standalone via a plain
// `npm install` in this folder alone, with no monorepo/workspace context
// required. Namecheap's cPanel Node.js Selector runs npm install scoped to
// exactly one folder, which doesn't understand npm workspaces' "*" protocol.
//
// If you change packages/shared/src/*.ts, re-run `node scripts/sync-standalone.mjs`
// from the repo root to update this copy.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCIAL_GRADIENTS = exports.BRAND_COLORS = exports.BRAND = exports.ROLE_DEFAULT_PERMISSIONS = exports.ROLES = exports.PERMISSIONS = void 0;
exports.hasPermission = hasPermission;
exports.effectivePermissions = effectivePermissions;
exports.buildBuyRequestWhatsAppUrl = buildBuyRequestWhatsAppUrl;
exports.slugify = slugify;
exports.formatCurrency = formatCurrency;
exports.computeStockLevel = computeStockLevel;
exports.computeDiscountPercent = computeDiscountPercent;
exports.parseSocialVideoUrl = parseSocialVideoUrl;
// ---- from packages/shared/src/permissions.ts ----
// Central permission registry shared by the API (enforcement) and the Web app
// (UI gating). The API is always the source of truth — the frontend only
// uses this to hide/show controls, never to authorize an action.
exports.PERMISSIONS = {
    PRODUCTS_VIEW: "products.view",
    PRODUCTS_CREATE: "products.create",
    PRODUCTS_EDIT: "products.edit",
    PRODUCTS_DELETE: "products.delete",
    PRODUCTS_MANAGE_STOCK: "products.manageStock",
    PRODUCTS_MARK_SOLD: "products.markSold",
    PRODUCTS_MANAGE_REVIEWS: "products.manageReviews",
    CATALOG_MANAGE_BRANDS: "catalog.manageBrands",
    CATALOG_MANAGE_CATEGORIES: "catalog.manageCategories",
    CATALOG_MANAGE_COLORS: "catalog.manageColors",
    BRANCHES_MANAGE: "branches.manage",
    STAFF_VIEW: "staff.view",
    STAFF_MANAGE: "staff.manage",
    STAFF_MANAGE_ROLES: "staff.manageRoles",
    CONTENT_HOMEPAGE: "content.homepage",
    CONTENT_BANNERS: "content.banners",
    CONTENT_SEO: "content.seo",
    SETTINGS_MANAGE: "settings.manage",
    SETTINGS_MANAGE_DANGEROUS: "settings.manageDangerous",
    BUY_REQUESTS_VIEW: "buyRequests.view",
    BUY_REQUESTS_MANAGE: "buyRequests.manage",
    BUY_REQUESTS_REFER: "buyRequests.refer",
    SALES_RECORD: "sales.record",
    SALES_VIEW_OWN: "sales.viewOwn",
    SALES_VIEW_ALL: "sales.viewAll",
    SALES_ANALYTICS: "sales.analytics",
    SOCIAL_GENERATE: "social.generate",
    AUDIT_VIEW: "audit.view",
    SYSTEM_RESET: "system.reset",
};
exports.ROLES = {
    SUPER_ADMIN: "SUPER_ADMIN",
    ADMIN: "ADMIN",
    SALES_MANAGER: "SALES_MANAGER",
    SALES_STAFF: "SALES_STAFF",
    CONTENT_MANAGER: "CONTENT_MANAGER",
};
const ALL_PERMISSIONS = Object.values(exports.PERMISSIONS);
// Default permission sets per role. SUPER_ADMIN always has everything and is
// handled as a wildcard bypass in hasPermission() rather than listed here.
exports.ROLE_DEFAULT_PERMISSIONS = {
    SUPER_ADMIN: ALL_PERMISSIONS,
    ADMIN: ALL_PERMISSIONS.filter((p) => p !== exports.PERMISSIONS.SYSTEM_RESET && p !== exports.PERMISSIONS.STAFF_MANAGE_ROLES),
    CONTENT_MANAGER: [
        exports.PERMISSIONS.PRODUCTS_VIEW,
        exports.PERMISSIONS.PRODUCTS_CREATE,
        exports.PERMISSIONS.PRODUCTS_EDIT,
        exports.PERMISSIONS.PRODUCTS_MANAGE_REVIEWS,
        exports.PERMISSIONS.CATALOG_MANAGE_BRANDS,
        exports.PERMISSIONS.CATALOG_MANAGE_CATEGORIES,
        exports.PERMISSIONS.CATALOG_MANAGE_COLORS,
        exports.PERMISSIONS.CONTENT_HOMEPAGE,
        exports.PERMISSIONS.CONTENT_BANNERS,
        exports.PERMISSIONS.CONTENT_SEO,
        exports.PERMISSIONS.SOCIAL_GENERATE,
    ],
    SALES_MANAGER: [
        exports.PERMISSIONS.PRODUCTS_VIEW,
        exports.PERMISSIONS.PRODUCTS_MANAGE_STOCK,
        exports.PERMISSIONS.PRODUCTS_MARK_SOLD,
        exports.PERMISSIONS.BRANCHES_MANAGE,
        exports.PERMISSIONS.STAFF_VIEW,
        exports.PERMISSIONS.BUY_REQUESTS_VIEW,
        exports.PERMISSIONS.BUY_REQUESTS_MANAGE,
        exports.PERMISSIONS.BUY_REQUESTS_REFER,
        exports.PERMISSIONS.SALES_RECORD,
        exports.PERMISSIONS.SALES_VIEW_OWN,
        exports.PERMISSIONS.SALES_VIEW_ALL,
        exports.PERMISSIONS.SALES_ANALYTICS,
    ],
    SALES_STAFF: [
        exports.PERMISSIONS.PRODUCTS_VIEW,
        exports.PERMISSIONS.PRODUCTS_MANAGE_STOCK,
        exports.PERMISSIONS.PRODUCTS_MARK_SOLD,
        exports.PERMISSIONS.BUY_REQUESTS_VIEW,
        exports.PERMISSIONS.SALES_RECORD,
        exports.PERMISSIONS.SALES_VIEW_OWN,
    ],
};
/** Effective permission check: role defaults, plus per-user grant/revoke overrides. */
function hasPermission(user, permission) {
    if (user.role === exports.ROLES.SUPER_ADMIN)
        return true;
    const revoked = user.permissions?.revoke ?? [];
    if (revoked.includes(permission))
        return false;
    const granted = user.permissions?.grant ?? [];
    if (granted.includes(permission))
        return true;
    return exports.ROLE_DEFAULT_PERMISSIONS[user.role]?.includes(permission) ?? false;
}
function effectivePermissions(user) {
    if (user.role === exports.ROLES.SUPER_ADMIN)
        return ALL_PERMISSIONS;
    const base = new Set(exports.ROLE_DEFAULT_PERMISSIONS[user.role] ?? []);
    for (const g of user.permissions?.grant ?? [])
        base.add(g);
    for (const r of user.permissions?.revoke ?? [])
        base.delete(r);
    return Array.from(base);
}
// ---- from packages/shared/src/brand.ts ----
// Brand tokens derived from the VIP Mobiles crest logo (black + gold, premium/luxury).
// Single source of truth: Tailwind theme (frontend) and the social-creative
// canvas renderer (backend) both read from this file so exported posts and
// the live site never drift apart.
exports.BRAND = {
    name: "VIP Mobiles",
    tagline: "Smart Phones • Accessories • Services",
};
exports.BRAND_COLORS = {
    black: {
        950: "#08080A",
        900: "#0B0B0D",
        800: "#141417",
        700: "#1D1D21",
        600: "#2A2A30",
    },
    gold: {
        50: "#FDF6E3",
        100: "#FBEBC2",
        200: "#F6D680",
        300: "#F0C04D",
        400: "#E8AA2E",
        500: "#D4941E", // primary brand gold
        600: "#B8791A",
        700: "#8F5D14",
        800: "#6B4610",
        900: "#4A300B",
    },
    cream: "#F5F1E8", // warm off-white for text on dark surfaces
    muted: "#A8A29A", // warm gray for secondary text
};
// 7-8 subtle background variations for the social creative generator, all
// built from the same brand palette so posts stay consistent but not identical.
exports.SOCIAL_GRADIENTS = [
    { id: "midnight-gold", from: "#0B0B0D", to: "#2A2410", angle: 135 },
    { id: "onyx-amber", from: "#141417", to: "#4A300B", angle: 160 },
    { id: "black-royale", from: "#08080A", to: "#3A2A08", angle: 120 },
    { id: "espresso-gold", from: "#1D1D21", to: "#6B4610", angle: 145 },
    { id: "charcoal-honey", from: "#0B0B0D", to: "#8F5D14", angle: 110 },
    { id: "deep-bronze", from: "#08080A", to: "#4A300B", angle: 200 },
    { id: "graphite-champagne", from: "#141417", to: "#B8791A", angle: 100 },
    { id: "noir-sunburst", from: "#0B0B0D", to: "#D4941E", angle: 135 },
];
function buildBuyRequestWhatsAppUrl(input) {
    const currency = input.currency ?? "PKR";
    const lines = [
        `Hi VIP Mobiles, I am interested in buying *${input.productTitle}*.`,
        `Listed price: ${currency} ${input.listedPrice}`,
    ];
    if (input.variantLabel)
        lines.push(`Variant: ${input.variantLabel}`);
    if (input.boxAvailable !== undefined && input.boxAvailable !== null) {
        lines.push(`Box available: ${input.boxAvailable ? "Yes" : "No"}`);
    }
    if (input.offeredPrice !== undefined && input.offeredPrice !== null && input.offeredPrice !== "") {
        lines.push(`My offered price: ${currency} ${input.offeredPrice}`);
    }
    if (input.customerMessage)
        lines.push(`Message: ${input.customerMessage}`);
    lines.push(`Product link: ${input.productUrl}`);
    lines.push(`My name: ${input.customerName}`);
    lines.push(`Please contact me. Thank you.`);
    const text = encodeURIComponent(lines.join("\n"));
    const number = input.storeWhatsAppNumber.replace(/[^\d]/g, "");
    return `https://wa.me/${number}?text=${text}`;
}
// ---- from packages/shared/src/utils.ts ----
function slugify(input) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 180);
}
function formatCurrency(amount, currency = "PKR") {
    const value = typeof amount === "string" ? Number(amount) : amount;
    if (Number.isNaN(value))
        return `${currency} 0`;
    return `${currency} ${new Intl.NumberFormat("en-US").format(value)}`;
}
const LOW_STOCK_THRESHOLD = 3;
// Single source of truth for stock/discount badge logic — the storefront
// (product cards, product page) and the social post generator both need
// the exact same "is this a hot deal / low stock / new arrival" answer for
// a given product, so it's defined once here rather than duplicated in the
// frontend and backend.
function computeStockLevel(product) {
    if (product.status === "SOLD" || product.status === "HIDDEN")
        return "OUT_OF_STOCK";
    if (product.status === "RESERVED")
        return "RESERVED";
    if (product.unitsInStockCount != null) {
        if (product.unitsInStockCount <= 0)
            return "OUT_OF_STOCK";
        if (product.unitsInStockCount <= LOW_STOCK_THRESHOLD)
            return "LOW_STOCK";
        return "IN_STOCK";
    }
    if (product.variants && product.variants.length > 0) {
        const total = product.variants.reduce((sum, v) => sum + (v.stockQty ?? 0), 0);
        if (total <= 0)
            return "OUT_OF_STOCK";
        if (total <= LOW_STOCK_THRESHOLD)
            return "LOW_STOCK";
    }
    return "IN_STOCK";
}
function computeDiscountPercent(product) {
    const base = typeof product.basePrice === "string" ? Number(product.basePrice) : product.basePrice;
    const compareAt = product.compareAtPrice
        ? typeof product.compareAtPrice === "string"
            ? Number(product.compareAtPrice)
            : product.compareAtPrice
        : null;
    if (!compareAt || compareAt <= base)
        return null;
    return Math.round(((compareAt - base) / compareAt) * 100);
}
/** Extracts a normalized video id/embed info from a YouTube, TikTok or Instagram URL. */
function parseSocialVideoUrl(url) {
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
    }
    catch {
        return { platform: null, embedId: null };
    }
}
