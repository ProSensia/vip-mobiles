"use client";

import { useState } from "react";
import { Receipt, QrCode } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { SaleDetailModal } from "@/components/portal/SaleDetailModal";
import { useFetch } from "@/lib/useFetch";
import { formatCurrency, formatDate } from "@/lib/utils";

interface SaleRow {
  id: string;
  soldPrice: string;
  saleDate: string;
  customerName?: string | null;
  billUrl?: string | null;
  reviewToken?: string | null;
  reviewSubmittedAt?: string | null;
  product: { title: string; slug: string };
  branch?: { name: string } | null;
}

export default function PortalSalesPage() {
  const { data, loading, setData } = useFetch<{ items: SaleRow[]; total: number }>("/sales?limit=50");
  const [selected, setSelected] = useState<SaleRow | null>(null);

  function handleUpdated(updated: SaleRow) {
    setSelected(updated);
    setData((prev) => (prev ? { ...prev, items: prev.items.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)) } : prev));
  }

  const columns: Column<SaleRow>[] = [
    { key: "product", header: "Product", render: (s) => s.product.title },
    { key: "customer", header: "Customer", render: (s) => s.customerName || "—" },
    { key: "branch", header: "Branch", render: (s) => s.branch?.name || "—" },
    { key: "price", header: "Sold Price", render: (s) => formatCurrency(s.soldPrice) },
    { key: "date", header: "Date", render: (s) => formatDate(s.saleDate) },
    {
      key: "actions",
      header: "Bill / Review",
      render: (s) => (
        <button
          onClick={() => setSelected(s)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-muted hover:text-gold-400 hover:border-gold-500/40"
        >
          {s.billUrl ? <Receipt className="h-3.5 w-3.5 text-green-400" /> : <Receipt className="h-3.5 w-3.5" />}
          {s.reviewToken ? <QrCode className="h-3.5 w-3.5 text-green-400" /> : <QrCode className="h-3.5 w-3.5" />}
          Manage
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="My Sales" description={`${data?.total ?? 0} sales recorded`} />
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyTitle="No sales recorded yet" emptyDescription="Sales you record from the Products page will appear here." />
      {selected && <SaleDetailModal sale={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />}
    </div>
  );
}
