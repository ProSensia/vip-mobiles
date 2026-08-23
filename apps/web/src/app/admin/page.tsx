import { Smartphone, CheckCircle2, EyeOff, MessageSquareText, TrendingUp } from "lucide-react";
import { serverApi, ApiError } from "@/lib/api";
import { getSession } from "@/lib/session";
import { StatCard } from "@/components/admin/StatCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 401)) return null;
    throw err;
  }
}

export default async function AdminDashboardPage() {
  const user = await getSession();

  const [inventory, analytics, buyRequests] = await Promise.all([
    safe(() => serverApi<{ counts: any; availableInventoryValue: number }>("/api/sales/inventory-stats")),
    safe(() => serverApi<{ totals: any; byStaff: any[]; bestSellingBrands: any[] }>("/api/sales/analytics")),
    safe(() => serverApi<{ requests: any[] }>("/api/buy-requests?status=NEW")),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-cream">Welcome back, {user?.name?.split(" ")[0]}</h2>
        <p className="mt-1 text-sm text-muted">Here&apos;s what&apos;s happening at VIP Mobiles today.</p>
      </div>

      {inventory && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Available" value={inventory.counts.available} icon={CheckCircle2} tone="green" />
          <StatCard label="Reserved" value={inventory.counts.reserved} icon={Smartphone} tone="blue" />
          <StatCard label="Sold" value={inventory.counts.sold} icon={TrendingUp} tone="gold" />
          <StatCard label="Hidden" value={inventory.counts.hidden} icon={EyeOff} tone="red" />
        </div>
      )}

      {analytics && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Revenue (30 days)" value={formatCurrency(analytics.totals.revenue)} icon={TrendingUp} tone="gold" />
          <StatCard label="Profit (30 days)" value={formatCurrency(analytics.totals.profit)} icon={TrendingUp} tone="green" />
          <StatCard label="Units Sold (30 days)" value={analytics.totals.count} icon={CheckCircle2} tone="blue" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {analytics && analytics.byStaff.length > 0 && (
          <Card>
            <CardHeader title="Top Performing Staff" subtitle="Last 30 days" />
            <CardBody className="space-y-3">
              {analytics.byStaff.slice(0, 5).map((s: any) => (
                <div key={s.staffId} className="flex items-center justify-between text-sm">
                  <span className="text-cream/90">{s.name}</span>
                  <span className="font-medium text-gold-400">{formatCurrency(s.revenue)} · {s.count} sold</span>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {buyRequests && (
          <Card>
            <CardHeader
              title="New Buy Requests"
              subtitle={`${buyRequests.requests.length} awaiting response`}
              action={<Link href="/admin/buy-requests" className="text-xs font-medium text-gold-400 hover:underline">View all</Link>}
            />
            <CardBody className="space-y-3">
              {buyRequests.requests.length === 0 && <p className="text-sm text-muted">No new requests. You&apos;re all caught up.</p>}
              {buyRequests.requests.slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-gold-400" />
                    <span className="text-cream/90">{r.customerName} — {r.product.title}</span>
                  </div>
                  <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        )}
      </div>

      {!inventory && !analytics && (
        <p className="text-sm text-muted">Your account doesn&apos;t have access to analytics. Use the sidebar to manage the areas assigned to you.</p>
      )}
    </div>
  );
}
