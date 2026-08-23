"use client";

import { TrendingUp, DollarSign, Package, Users } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
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
  byDate: Array<{ date: string; count: number; revenue: number }>;
}

const GOLD = "#E8AA2E";
const GRID = "#2A2A30";
const AXIS_TEXT = { fill: "#A8A29A", fontSize: 11 };

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-medium text-cream">{label}</p>
      <p className="text-gold-400">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

function CountTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-medium text-cream">{label}</p>
      <p className="text-gold-400">{payload[0].value} sold</p>
    </div>
  );
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

          <Card>
            <CardHeader title="Revenue Trend" subtitle="Daily revenue over the selected period." />
            <CardBody>
              {data.byDate.length === 0 ? (
                <p className="text-sm text-muted">No sales yet.</p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.byDate} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GOLD} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="date" tick={AXIS_TEXT} tickLine={false} axisLine={{ stroke: GRID }} />
                      <YAxis
                        tick={AXIS_TEXT}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                        tickFormatter={(v) => formatCurrency(v)}
                      />
                      <Tooltip content={<RevenueTooltip />} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke={GOLD} fill="url(#revenueFill)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="Sales by Branch" />
              <CardBody>
                {data.byBranch.length === 0 ? (
                  <p className="text-sm text-muted">No sales yet.</p>
                ) : (
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byBranch} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid stroke={GRID} horizontal={false} />
                        <XAxis type="number" tick={AXIS_TEXT} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} />
                        <YAxis type="category" dataKey="name" tick={{ fill: "#F5F1E8", fontSize: 12 }} tickLine={false} axisLine={false} width={90} />
                        <Tooltip content={<RevenueTooltip />} cursor={{ fill: "rgba(212,148,30,0.08)" }} />
                        <Bar dataKey="revenue" name="Revenue" fill={GOLD} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
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
              <CardBody>
                {data.bestSellingBrands.length === 0 ? (
                  <p className="text-sm text-muted">No sales yet.</p>
                ) : (
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.bestSellingBrands} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid stroke={GRID} horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={AXIS_TEXT} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: "#F5F1E8", fontSize: 12 }} tickLine={false} axisLine={false} width={90} />
                        <Tooltip content={<CountTooltip />} cursor={{ fill: "rgba(212,148,30,0.08)" }} />
                        <Bar dataKey="count" name="Sold" fill={GOLD} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
