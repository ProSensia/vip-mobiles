// Plain data — deliberately NOT in MobileNav.tsx ("use client"): a Server
// Component (Header) importing a non-component export from a client-boundary
// file can receive a client reference stub instead of the real value in
// production RSC builds. Keeping this in its own server-safe module lets
// both Header (server) and MobileNav (client) import the same array safely.
export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/catalog", label: "Catalog" },
  { href: "/accessories", label: "Accessories" },
  { href: "/branches", label: "Branches" },
  { href: "/about", label: "About & Team" },
] as const;
