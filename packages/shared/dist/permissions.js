"use strict";
// Central permission registry shared by the API (enforcement) and the Web app
// (UI gating). The API is always the source of truth — the frontend only
// uses this to hide/show controls, never to authorize an action.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_DEFAULT_PERMISSIONS = exports.ROLES = exports.PERMISSIONS = void 0;
exports.hasPermission = hasPermission;
exports.effectivePermissions = effectivePermissions;
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
