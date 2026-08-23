"use client";

import { TrendingUp, DollarSign, Package, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { useFetch } from "@/lib/useFetch";
import { formatCurrency } from "@/lib/utils";

interface Analytics {
  totals: { count: number; revenue: number; profit: number };
  byBranch: Array<{ branchId: string | null; name: string; count: number; revenue: number }>;
  byStaff: Array<{ staffId: string; name: string; count: number; revenue: number }>;
  bestSellingBrands: Array<{ name: string; count: number; revenue: number }>;
}

export default function SalesAnalyticsPage() {
  const { data, loading } = useFetch<Analytics>("/sales/analytics");

  return (
    <div>
      <PageHeader title="Sales & Analytics" description="Revenue, profit and performance across branches and staff (last 30 days)." />

      {loading || !data ? (
        <p className="text-sm text-muted">Loading analytics...</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Revenue" value={formatCurrency(data.totals.revenue)} icon={DollarSign} tone="gold" />
            <StatCard label="Profit" value={formatCurrency(data.totals.profit)} icon={TrendingUp} tone="green" />
            <StatCard label="Units Sold" value={data.totals.count} icon={Package} tone="blue" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="Sales by Branch" />
              <CardBody className="space-y-3">
                {data.byBranch.length === 0 && <p className="text-sm text-muted">No sales yet.</p>}
                {data.byBranch.map((b) => (
                  <div key={b.branchId ?? "none"} className="flex justify-between text-sm">
                    <span className="text-cream/90">{b.name}</span>
                    <span className="font-medium text-gold-400">{formatCurrency(b.revenue)} · {b.count}</span>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Sales by Staff" action={<Users className="h-4 w-4 text-muted" />} />
              <CardBody className="space-y-3">
                {data.byStaff.length === 0 && <p className="text-sm text-muted">No sales yet.</p>}
                {data.byStaff.map((s) => (
                  <div key={s.staffId} className="flex justify-between text-sm">
                    <span className="text-cream/90">{s.name}</span>
                    <span className="font-medium text-gold-400">{formatCurrency(s.revenue)} · {s.count}</span>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Best-Selling Brands" />
              <CardBody className="space-y-3">
                {data.bestSellingBrands.length === 0 && <p className="text-sm text-muted">No sales yet.</p>}
                {data.bestSellingBrands.map((b) => (
                  <div key={b.name} className="flex justify-between text-sm">
                    <span className="text-cream/90">{b.name}</span>
                    <span className="font-medium text-gold-400">{b.count} sold</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
