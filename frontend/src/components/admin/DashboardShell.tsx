"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { clientApi } from "@/lib/clientApi";
import type { SessionUser } from "@/lib/session";

// icon is a pre-rendered element (not a component reference) — the caller is
// a Server Component, and passing a raw component/function as a prop across
// the server→client boundary isn't serializable ("Functions cannot be passed
// directly to Client Components").
export interface RenderedNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export function DashboardShell({
  nav,
  user,
  title,
  children,
}: {
  nav: RenderedNavItem[];
  user: SessionUser;
  title: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await clientApi.post("/auth/logout");
    router.push("/login");
    router.refresh();
  }

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 px-5 py-5">
        <Image src="/brand/logo.jpg" alt="VIP Mobiles" width={36} height={36} className="rounded-full" />
        <span className="font-display text-base font-bold text-cream">VIP Mobiles</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && item.href !== "/portal" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-gold-500/15 text-gold-400" : "text-cream/80 hover:bg-ink-800 hover:text-cream"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-ink-600 p-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream/70 hover:bg-ink-800">
          <ExternalLink className="h-[18px] w-[18px]" /> View Storefront
        </Link>
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream/70 hover:bg-ink-800">
          <LogOut className="h-[18px] w-[18px]" /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-ink-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-600 bg-ink-900 md:flex">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex w-72 flex-col border-r border-ink-600 bg-ink-900">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-cream hover:bg-ink-800">
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-ink-600 bg-ink-950/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-cream hover:bg-ink-800 md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-display text-lg font-semibold text-cream">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-cream">{user.name}</p>
              <p className="text-xs text-muted">{user.role.replace(/_/g, " ")}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500/15 text-sm font-bold text-gold-400">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
