import {
  LayoutDashboard,
  Smartphone,
  Tags,
  LayoutGrid,
  Palette,
  Building2,
  Users,
  Home,
  Image as ImageIcon,
  MessageSquareText,
  Sparkles,
  BarChart3,
  Settings,
  ScrollText,
  RotateCcw,
  ShoppingBag,
  ReceiptText,
  Headphones,
  UserCircle,
  ClipboardCheck,
  ScanLine,
  PackageCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Permission } from "../../shared";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  superAdminOnly?: boolean;
}

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/scan", label: "Scan & Sell", icon: ScanLine, permission: "sales.record" },
  { href: "/admin/products", label: "Products", icon: Smartphone, permission: "products.view" },
  { href: "/admin/accessories", label: "Accessories", icon: Headphones, permission: "products.view" },
  { href: "/admin/brands", label: "Brands", icon: Tags, permission: "catalog.manageBrands" },
  { href: "/admin/categories", label: "Categories", icon: LayoutGrid, permission: "catalog.manageCategories" },
  { href: "/admin/colors", label: "Colors", icon: Palette, permission: "catalog.manageColors" },
  { href: "/admin/branches", label: "Branches", icon: Building2, permission: "branches.manage" },
  { href: "/admin/staff", label: "Staff & Roles", icon: Users, permission: "staff.view" },
  { href: "/admin/team", label: "About & Team", icon: UserCircle, permission: "staff.view" },
  { href: "/admin/homepage", label: "Homepage", icon: Home, permission: "content.homepage" },
  { href: "/admin/banners", label: "Banners", icon: ImageIcon, permission: "content.banners" },
  { href: "/admin/buy-requests", label: "Buy Requests", icon: MessageSquareText, permission: "buyRequests.view" },
  { href: "/admin/approvals", label: "Approvals & Requests", icon: ClipboardCheck, permission: "products.manageReviews" },
  { href: "/admin/social", label: "Social Generator", icon: Sparkles, permission: "social.generate" },
  { href: "/admin/sales", label: "Sales & Analytics", icon: BarChart3, permission: "sales.analytics" },
  { href: "/admin/sold-inventory", label: "Sold Mobiles", icon: PackageCheck, permission: "sales.viewOwn" },
  { href: "/admin/settings", label: "Store Settings", icon: Settings, permission: "settings.manage" },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText, permission: "audit.view" },
  { href: "/admin/system", label: "Go-Live Setup", icon: RotateCcw, superAdminOnly: true },
];

export const PORTAL_NAV: NavItem[] = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/scan", label: "Scan & Sell", icon: ScanLine, permission: "sales.record" },
  { href: "/portal/products", label: "Products", icon: ShoppingBag, permission: "products.view" },
  { href: "/portal/sales", label: "My Sales", icon: ReceiptText, permission: "sales.viewOwn" },
  { href: "/portal/buy-requests", label: "Buy Requests", icon: MessageSquareText, permission: "buyRequests.view" },
];

export function filterNav(items: NavItem[], permissions: Permission[], role: string): NavItem[] {
  return items.filter((item) => {
    if (item.superAdminOnly) return role === "SUPER_ADMIN";
    if (!item.permission) return true;
    return permissions.includes(item.permission);
  });
}
