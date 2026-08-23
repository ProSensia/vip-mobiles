import { TrendingUp, Package, MessageSquareText } from "lucide-react";
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

export default async function PortalDashboardPage() {
  const user = await getSession();

  const [salesData, buyRequests] = await Promise.all([
    safe(() => serverApi<{ items: any[]; total: number }>("/api/sales?limit=5")),
    safe(() => serverApi<{ requests: any[] }>("/api/buy-requests?status=NEW")),
  ]);

  const recentSales = salesData?.items ?? [];
  const monthRevenue = recentSales.reduce((sum, s) => sum + Number(s.soldPrice), 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-cream">Welcome back, {user?.name?.split(" ")[0]}</h2>
        <p className="mt-1 text-sm text-muted">Here&apos;s your sales activity summary.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Recent Sales" value={salesData?.total ?? 0} icon={Package} tone="blue" />
        <StatCard label="Recent Revenue" value={formatCurrency(monthRevenue)} icon={TrendingUp} tone="gold" />
        <StatCard label="New Buy Requests" value={buyRequests?.requests.length ?? 0} icon={MessageSquareText} tone="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent Sales" action={<Link href="/portal/sales" className="text-xs font-medium text-gold-400 hover:underline">View all</Link>} />
          <CardBody className="space-y-3">
            {recentSales.length === 0 && <p className="text-sm text-muted">No sales recorded yet.</p>}
            {recentSales.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-cream/90">{s.product.title}</span>
                <span className="font-medium text-gold-400">{formatCurrency(s.soldPrice)}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="New Buy Requests" action={<Link href="/portal/buy-requests" className="text-xs font-medium text-gold-400 hover:underline">View all</Link>} />
          <CardBody className="space-y-3">
            {(buyRequests?.requests.length ?? 0) === 0 && <p className="text-sm text-muted">No new requests.</p>}
            {buyRequests?.requests.slice(0, 5).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-cream/90">{r.customerName} — {r.product.title}</span>
                <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
