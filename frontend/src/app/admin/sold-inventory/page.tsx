"use client";

import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ConditionBadge } from "@/components/ui/Badge";
import { useFetch } from "@/lib/useFetch";
import { useCurrentUser } from "@/lib/currentUser";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PERMISSIONS } from "@/shared";

interface SoldRow {
  id: string;
  soldPrice: string;
  costPrice: string | null;
  profit: string | null;
  saleDate: string;
  customerName?: string | null;
  customerContact?: string | null;
  product: { id: string; title: string; slug: string; condition: string };
  branch?: { name: string } | null;
  staff: { name: string };
  unit?: { id: string; imei1: string | null; imei2: string | null; qrCode: string | null } | null;
}

// Every Sale row is, by definition, a completed sale — reuses the existing
// GET /sales (already returns unit IMEI/QR and cost/profit only for
// SALES_ANALYTICS holders) instead of a second, parallel "sold" endpoint.
export default function SoldInventoryPage() {
  const { data, loading } = useFetch<{ items: SoldRow[]; total: number }>("/sales?limit=100");
  const user = useCurrentUser();
  const canSeeCost = !!user?.permissions.includes(PERMISSIONS.SALES_ANALYTICS);

  const columns: Column<SoldRow>[] = [
    {
      key: "product",
      header: "Product",
      render: (s) => (
        <div>
          <p className="font-medium">{s.product.title}</p>
          <ConditionBadge condition={s.product.condition} />
        </div>
      ),
    },
    {
      key: "identifier",
      header: "IMEI / QR",
      render: (s) =>
        s.unit ? (
          <div className="font-mono text-xs">
            <p>{s.unit.qrCode || s.unit.imei1 || "—"}</p>
            {s.unit.imei2 && <p className="text-muted">IMEI2: {s.unit.imei2}</p>}
          </div>
        ) : (
          <span className="text-xs text-muted">Not serialized</span>
        ),
    },
    { key: "branch", header: "Branch", render: (s) => s.branch?.name || "—" },
    { key: "seller", header: "Sold By", render: (s) => s.staff.name },
    { key: "price", header: "Sold Price", render: (s) => formatCurrency(s.soldPrice) },
    ...(canSeeCost
      ? [
          { key: "cost", header: "Purchase Price", render: (s: SoldRow) => (s.costPrice ? formatCurrency(s.costPrice) : "—") },
          {
            key: "profit",
            header: "Profit",
            render: (s: SoldRow) => (s.profit != null ? <span className="font-medium text-emerald-400">{formatCurrency(s.profit)}</span> : "—"),
          },
        ]
      : []),
    { key: "customer", header: "Customer", render: (s) => s.customerName || "—" },
    { key: "date", header: "Date", render: (s) => formatDate(s.saleDate) },
  ];

  return (
    <div>
      <PageHeader title="Sold Mobiles" description={`${data?.total ?? 0} completed sales`} />
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        loading={loading}
        emptyTitle="No sales yet"
        emptyDescription="Completed sales — from Scan & Sell or a manual record — will appear here automatically."
      />
    </div>
  );
}
