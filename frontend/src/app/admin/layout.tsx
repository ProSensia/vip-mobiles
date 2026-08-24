import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DashboardShell } from "@/components/admin/DashboardShell";
import { ADMIN_NAV, filterNav } from "@/components/admin/nav";

// Every page under /admin is per-visitor (auth-gated) content — never let
// Next statically prerender/cache this route tree, or a build-time render
// (with no real session) would bake in a redirect-to-login for everyone.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login?next=/admin");
  if (user.mustChangePassword) redirect("/change-password-required");

  const nav = filterNav(ADMIN_NAV, user.permissions, user.role).map((item) => ({
    href: item.href,
    label: item.label,
    icon: <item.icon className="h-[18px] w-[18px]" />,
  }));

  return (
    <DashboardShell nav={nav} user={user} title="Admin Dashboard">
      {children}
    </DashboardShell>
  );
}
