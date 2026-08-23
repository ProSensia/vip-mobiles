"use client";

import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { useFetch } from "@/lib/useFetch";
import { formatCurrency, formatDate } from "@/lib/utils";

interface SaleRow {
  id: string;
  soldPrice: string;
  saleDate: string;
  customerName?: string | null;
  product: { title: string; slug: string };
  branch?: { name: string } | null;
}

export default function PortalSalesPage() {
  const { data, loading } = useFetch<{ items: SaleRow[]; total: number }>("/sales?limit=50");

  const columns: Column<SaleRow>[] = [
    { key: "product", header: "Product", render: (s) => s.product.title },
    { key: "customer", header: "Customer", render: (s) => s.customerName || "—" },
    { key: "branch", header: "Branch", render: (s) => s.branch?.name || "—" },
    { key: "price", header: "Sold Price", render: (s) => formatCurrency(s.soldPrice) },
    { key: "date", header: "Date", render: (s) => formatDate(s.saleDate) },
  ];

  return (
    <div>
      <PageHeader title="My Sales" description={`${data?.total ?? 0} sales recorded`} />
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyTitle="No sales recorded yet" emptyDescription="Sales you record from the Products page will appear here." />
    </div>
  );
}
