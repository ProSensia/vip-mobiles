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
  BUY_REQUESTS_REFER: "buyRequests.refer",

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
    PERMISSIONS.BUY_REQUESTS_REFER,
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
