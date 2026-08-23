// Self-contained copy of packages/shared/src/*.ts — duplicated here (not an
// npm/workspace dependency) so this app installs standalone via a plain
// `npm install` in this folder alone, with no monorepo/workspace context
// required. Namecheap's cPanel Node.js Selector runs npm install scoped to
// exactly one folder, which doesn't understand npm workspaces' "*" protocol.
//
// If you change packages/shared/src/*.ts, re-run `node scripts/sync-standalone.mjs`
// from the repo root to update this copy.

// ---- from packages/shared/src/permissions.ts ----
// Central permission registry shared by the API (enforcement) and the Web app
// (UI gating). The API is always the source of truth — the frontend only
// uses this to hide/show controls, never to authorize an action.

export const PERMISSIONS = {
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

  SALES_RECORD: "sales.record",
  SALES_VIEW_OWN: "sales.viewOwn",
  SALES_VIEW_ALL: "sales.viewAll",
  SALES_ANALYTICS: "sales.analytics",

  SOCIAL_GENERATE: "social.generate",

  AUDIT_VIEW: "audit.view",
  SYSTEM_RESET: "system.reset",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  SALES_MANAGER: "SALES_MANAGER",
  SALES_STAFF: "SALES_STAFF",
  CONTENT_MANAGER: "CONTENT_MANAGER",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

// Default permission sets per role. SUPER_ADMIN always has everything and is
// handled as a wildcard bypass in hasPermission() rather than listed here.
export const ROLE_DEFAULT_PERMISSIONS: Record<RoleName, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS.filter(
    (p) => p !== PERMISSIONS.SYSTEM_RESET && p !== PERMISSIONS.STAFF_MANAGE_ROLES
  ),
  CONTENT_MANAGER: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_EDIT,
    PERMISSIONS.PRODUCTS_MANAGE_REVIEWS,
    PERMISSIONS.CATALOG_MANAGE_BRANDS,
    PERMISSIONS.CATALOG_MANAGE_CATEGORIES,
    PERMISSIONS.CATALOG_MANAGE_COLORS,
    PERMISSIONS.CONTENT_HOMEPAGE,
    PERMISSIONS.CONTENT_BANNERS,
    PERMISSIONS.CONTENT_SEO,
    PERMISSIONS.SOCIAL_GENERATE,
  ],
  SALES_MANAGER: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_MANAGE_STOCK,
    PERMISSIONS.PRODUCTS_MARK_SOLD,
    PERMISSIONS.BRANCHES_MANAGE,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.BUY_REQUESTS_VIEW,
    PERMISSIONS.BUY_REQUESTS_MANAGE,
    PERMISSIONS.SALES_RECORD,
    PERMISSIONS.SALES_VIEW_OWN,
    PERMISSIONS.SALES_VIEW_ALL,
    PERMISSIONS.SALES_ANALYTICS,
  ],
  SALES_STAFF: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_MANAGE_STOCK,
    PERMISSIONS.PRODUCTS_MARK_SOLD,
    PERMISSIONS.BUY_REQUESTS_VIEW,
    PERMISSIONS.SALES_RECORD,
    PERMISSIONS.SALES_VIEW_OWN,
  ],
};

export interface PermissionOverrides {
  grant?: Permission[];
  revoke?: Permission[];
}

export interface PermissionSubject {
  role: RoleName;
  permissions?: PermissionOverrides | null;
}

/** Effective permission check: role defaults, plus per-user grant/revoke overrides. */
export function hasPermission(user: PermissionSubject, permission: Permission): boolean {
  if (user.role === ROLES.SUPER_ADMIN) return true;

  const revoked = user.permissions?.revoke ?? [];
  if (revoked.includes(permission)) return false;

  const granted = user.permissions?.grant ?? [];
  if (granted.includes(permission)) return true;

  return ROLE_DEFAULT_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function effectivePermissions(user: PermissionSubject): Permission[] {
  if (user.role === ROLES.SUPER_ADMIN) return ALL_PERMISSIONS;
  const base = new Set(ROLE_DEFAULT_PERMISSIONS[user.role] ?? []);
  for (const g of user.permissions?.grant ?? []) base.add(g);
  for (const r of user.permissions?.revoke ?? []) base.delete(r);
  return Array.from(base);
}

// ---- from packages/shared/src/brand.ts ----
// Brand tokens derived from the VIP Mobiles crest logo (black + gold, premium/luxury).
// Single source of truth: Tailwind theme (frontend) and the social-creative
// canvas renderer (backend) both read from this file so exported posts and
// the live site never drift apart.

export const BRAND = {
  name: "VIP Mobiles",
  tagline: "Smart Phones • Accessories • Services",
} as const;

export const BRAND_COLORS = {
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
} as const;

// 7-8 subtle background variations for the social creative generator, all
// built from the same brand palette so posts stay consistent but not identical.
export const SOCIAL_GRADIENTS = [
  { id: "midnight-gold", from: "#0B0B0D", to: "#2A2410", angle: 135 },
  { id: "onyx-amber", from: "#141417", to: "#4A300B", angle: 160 },
  { id: "black-royale", from: "#08080A", to: "#3A2A08", angle: 120 },
  { id: "espresso-gold", from: "#1D1D21", to: "#6B4610", angle: 145 },
  { id: "charcoal-honey", from: "#0B0B0D", to: "#8F5D14", angle: 110 },
  { id: "deep-bronze", from: "#08080A", to: "#4A300B", angle: 200 },
  { id: "graphite-champagne", from: "#141417", to: "#B8791A", angle: 100 },
  { id: "noir-sunburst", from: "#0B0B0D", to: "#D4941E", angle: 135 },
] as const;

export type SocialGradientId = (typeof SOCIAL_GRADIENTS)[number]["id"];

// ---- from packages/shared/src/whatsapp.ts ----
export interface BuyRequestWhatsAppInput {
  storeWhatsAppNumber: string; // digits only, with country code, e.g. "923001234567"
  customerName: string;
  productTitle: string;
  productUrl: string;
  listedPrice: number | string;
  currency?: string;
  variantLabel?: string | null;
  boxAvailable?: boolean | null;
  offeredPrice?: number | string | null;
  customerMessage?: string | null;
}

export function buildBuyRequestWhatsAppUrl(input: BuyRequestWhatsAppInput): string {
  const currency = input.currency ?? "PKR";
  const lines = [
    `Hi VIP Mobiles, I am interested in buying *${input.productTitle}*.`,
    `Listed price: ${currency} ${input.listedPrice}`,
  ];

  if (input.variantLabel) lines.push(`Variant: ${input.variantLabel}`);
  if (input.boxAvailable !== undefined && input.boxAvailable !== null) {
    lines.push(`Box available: ${input.boxAvailable ? "Yes" : "No"}`);
  }
  if (input.offeredPrice !== undefined && input.offeredPrice !== null && input.offeredPrice !== "") {
    lines.push(`My offered price: ${currency} ${input.offeredPrice}`);
  }
  if (input.customerMessage) lines.push(`Message: ${input.customerMessage}`);

  lines.push(`Product link: ${input.productUrl}`);
  lines.push(`My name: ${input.customerName}`);
  lines.push(`Please contact me. Thank you.`);

  const text = encodeURIComponent(lines.join("\n"));
  const number = input.storeWhatsAppNumber.replace(/[^\d]/g, "");
  return `https://wa.me/${number}?text=${text}`;
}

// ---- from packages/shared/src/utils.ts ----
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
