"use client";

import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Select } from "@/components/ui/Input";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BuyRequest {
  id: string;
  customerName: string;
  contact: string;
  offeredPrice?: string | null;
  status: string;
  createdAt: string;
  product: { title: string; slug: string; basePrice: string };
}

export default function PortalBuyRequestsPage() {
  const { data, loading, refetch } = useFetch<{ requests: BuyRequest[] }>("/buy-requests");

  async function updateStatus(id: string, status: string) {
    try {
      await clientApi.patch(`/buy-requests/${id}`, { status });
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "You don't have permission to update this");
    }
  }

  const columns: Column<BuyRequest>[] = [
    { key: "customer", header: "Customer", render: (r) => (
      <div><p className="font-medium">{r.customerName}</p><p className="text-xs text-muted">{r.contact}</p></div>
    ) },
    { key: "product", header: "Product", render: (r) => (
      <Link href={`/product/${r.product.slug}`} target="_blank" className="text-gold-400 hover:underline">{r.product.title}</Link>
    ) },
    { key: "price", header: "Listed / Offer", render: (r) => `${formatCurrency(r.product.basePrice)}${r.offeredPrice ? ` / ${formatCurrency(r.offeredPrice)}` : ""}` },
    { key: "date", header: "Date", render: (r) => formatDate(r.createdAt) },
    { key: "status", header: "Status", render: (r) => (
      <Select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)} className="h-8 w-32 text-xs">
        <option value="NEW">New</option>
        <option value="CONTACTED">Contacted</option>
        <option value="CLOSED">Closed</option>
      </Select>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Buy Requests" description="Customer purchase inquiries." />
      <DataTable columns={columns} rows={data?.requests ?? []} loading={loading} emptyTitle="No buy requests yet" />
    </div>
  );
}
