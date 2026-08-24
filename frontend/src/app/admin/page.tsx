import { Smartphone, CheckCircle2, EyeOff, MessageSquareText, TrendingUp, Package, Tags, LayoutGrid, Star, ScrollText } from "lucide-react";
import Image from "next/image";
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

  const [inventory, analytics, buyRequests, catalogStats, recentActivity] = await Promise.all([
    safe(() => serverApi<{ counts: any; availableInventoryValue: number }>("/api/sales/inventory-stats")),
    safe(() => serverApi<{ totals: any; byStaff: any[]; bestSellingBrands: any[] }>("/api/sales/analytics")),
    safe(() => serverApi<{ requests: any[] }>("/api/buy-requests?status=NEW")),
    safe(() => serverApi<{ totalBrands: number; totalCategories: number; featuredCount: number; recentProducts: any[] }>("/api/products/catalog-stats")),
    safe(() => serverApi<{ items: any[] }>("/api/audit-logs?limit=6")),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-cream">Welcome back, {user?.name?.split(" ")[0]}</h2>
        <p className="mt-1 text-sm text-muted">Here&apos;s what&apos;s happening at VIP Mobiles today.</p>
      </div>

      {(inventory || catalogStats) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {inventory && <StatCard label="Total Products" value={inventory.counts.total} icon={Package} tone="gold" />}
          {catalogStats && <StatCard label="Total Brands" value={catalogStats.totalBrands} icon={Tags} tone="blue" />}
          {catalogStats && <StatCard label="Total Categories" value={catalogStats.totalCategories} icon={LayoutGrid} tone="green" />}
          {catalogStats && <StatCard label="Featured Products" value={catalogStats.featuredCount} icon={Star} tone="gold" />}
        </div>
      )}

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

      <div className="grid gap-6 lg:grid-cols-2">
        {catalogStats && catalogStats.recentProducts.length > 0 && (
          <Card>
            <CardHeader
              title="Recently Added Products"
              action={<Link href="/admin/products" className="text-xs font-medium text-gold-400 hover:underline">View all</Link>}
            />
            <CardBody className="space-y-3">
              {catalogStats.recentProducts.map((p: any) => (
                <Link key={p.id} href={`/admin/products/${p.id}`} className="flex items-center gap-3 text-sm hover:text-gold-400">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-900">
                    {p.images[0] && (
                      <Image src={p.images[0].thumbUrl || p.images[0].url} alt="" fill className="object-cover" />
                    )}
                  </div>
                  <span className="flex-1 truncate text-cream/90">{p.title}</span>
                  <span className="shrink-0 text-xs text-muted">{formatDate(p.createdAt)}</span>
                </Link>
              ))}
            </CardBody>
          </Card>
        )}

        {recentActivity && recentActivity.items.length > 0 && (
          <Card>
            <CardHeader
              title="Recent Admin Activity"
              action={<Link href="/admin/audit-log" className="flex items-center gap-1 text-xs font-medium text-gold-400 hover:underline"><ScrollText className="h-3.5 w-3.5" /> View all</Link>}
            />
            <CardBody className="space-y-3">
              {recentActivity.items.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-cream/90">
                    {a.user?.name ?? "System"} — {a.action.replace(/\./g, " ").replace(/_/g, " ")}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatDate(a.createdAt)}</span>
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
