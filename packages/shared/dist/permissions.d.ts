export declare const PERMISSIONS: {
    readonly PRODUCTS_VIEW: "products.view";
    readonly PRODUCTS_CREATE: "products.create";
    readonly PRODUCTS_EDIT: "products.edit";
    readonly PRODUCTS_DELETE: "products.delete";
    readonly PRODUCTS_MANAGE_STOCK: "products.manageStock";
    readonly PRODUCTS_MARK_SOLD: "products.markSold";
    readonly PRODUCTS_MANAGE_REVIEWS: "products.manageReviews";
    readonly CATALOG_MANAGE_BRANDS: "catalog.manageBrands";
    readonly CATALOG_MANAGE_CATEGORIES: "catalog.manageCategories";
    readonly CATALOG_MANAGE_COLORS: "catalog.manageColors";
    readonly BRANCHES_MANAGE: "branches.manage";
    readonly STAFF_VIEW: "staff.view";
    readonly STAFF_MANAGE: "staff.manage";
    readonly STAFF_MANAGE_ROLES: "staff.manageRoles";
    readonly CONTENT_HOMEPAGE: "content.homepage";
    readonly CONTENT_BANNERS: "content.banners";
    readonly CONTENT_SEO: "content.seo";
    readonly SETTINGS_MANAGE: "settings.manage";
    readonly SETTINGS_MANAGE_DANGEROUS: "settings.manageDangerous";
    readonly BUY_REQUESTS_VIEW: "buyRequests.view";
    readonly BUY_REQUESTS_MANAGE: "buyRequests.manage";
    readonly SALES_RECORD: "sales.record";
    readonly SALES_VIEW_OWN: "sales.viewOwn";
    readonly SALES_VIEW_ALL: "sales.viewAll";
    readonly SALES_ANALYTICS: "sales.analytics";
    readonly SOCIAL_GENERATE: "social.generate";
    readonly AUDIT_VIEW: "audit.view";
    readonly SYSTEM_RESET: "system.reset";
};
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export declare const ROLES: {
    readonly SUPER_ADMIN: "SUPER_ADMIN";
    readonly ADMIN: "ADMIN";
    readonly SALES_MANAGER: "SALES_MANAGER";
    readonly SALES_STAFF: "SALES_STAFF";
    readonly CONTENT_MANAGER: "CONTENT_MANAGER";
};
export type RoleName = (typeof ROLES)[keyof typeof ROLES];
export declare const ROLE_DEFAULT_PERMISSIONS: Record<RoleName, Permission[]>;
export interface PermissionOverrides {
    grant?: Permission[];
    revoke?: Permission[];
}
export interface PermissionSubject {
    role: RoleName;
    permissions?: PermissionOverrides | null;
}
/** Effective permission check: role defaults, plus per-user grant/revoke overrides. */
export declare function hasPermission(user: PermissionSubject, permission: Permission): boolean;
export declare function effectivePermissions(user: PermissionSubject): Permission[];
