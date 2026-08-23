import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DashboardShell } from "@/components/admin/DashboardShell";
import { PORTAL_NAV, filterNav } from "@/components/admin/nav";

// Same reasoning as the admin layout: this is per-visitor content and must
// never be statically prerendered.
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login?next=/portal");

  const nav = filterNav(PORTAL_NAV, user.permissions, user.role);

  return (
    <DashboardShell nav={nav} user={user} title="Sales Portal">
      {children}
    </DashboardShell>
  );
}
