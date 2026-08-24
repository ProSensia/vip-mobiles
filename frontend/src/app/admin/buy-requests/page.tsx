"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { BuyRequestDetailModal } from "@/components/admin/BuyRequestDetailModal";
import { Button } from "@/components/ui/Button";
import { BuyRequestStatusBadge } from "@/components/ui/Badge";
import { useFetch } from "@/lib/useFetch";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BuyRequest {
  id: string;
  customerName: string;
  contact: string;
  offeredPrice?: string | null;
  message?: string | null;
  status: string;
  createdAt: string;
  product: { id: string; title: string; slug: string; basePrice: string };
  assignedTo?: { id: string; name: string; role: string } | null;
}

function BuyRequestsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data, loading, refetch } = useFetch<{ requests: BuyRequest[] }>("/buy-requests");
  const { data: meData } = useFetch<{ user: any }>("/auth/me");
  const [openId, setOpenId] = useState<string | null>(searchParams.get("id"));

  const canRefer = Boolean(meData?.user?.permissions?.includes("buyRequests.refer"));

  function openDetail(id: string) {
    setOpenId(id);
    router.replace(`/admin/buy-requests?id=${id}`, { scroll: false });
  }
  function closeDetail() {
    setOpenId(null);
    router.replace("/admin/buy-requests", { scroll: false });
  }

  const columns: Column<BuyRequest>[] = [
    { key: "customer", header: "Customer", render: (r) => (
      <div>
        <p className="font-medium">{r.customerName}</p>
        <p className="text-xs text-muted">{r.contact}</p>
      </div>
    ) },
    { key: "product", header: "Product", render: (r) => (
      <Link href={`/product/${r.product.slug}`} target="_blank" className="text-gold-400 hover:underline">{r.product.title}</Link>
    ) },
    { key: "price", header: "Listed / Offer", render: (r) => (
      <span>{formatCurrency(r.product.basePrice)}{r.offeredPrice ? ` / ${formatCurrency(r.offeredPrice)}` : ""}</span>
    ) },
    { key: "assignedTo", header: "Assigned To", render: (r) => (
      <span className={r.assignedTo ? "text-cream/90" : "text-muted"}>{r.assignedTo?.name ?? "Unassigned"}</span>
    ) },
    { key: "date", header: "Date", render: (r) => formatDate(r.createdAt) },
    { key: "status", header: "Status", render: (r) => <BuyRequestStatusBadge status={r.status} /> },
    { key: "actions", header: "", render: (r) => (
      <Button size="sm" variant="ghost" onClick={() => openDetail(r.id)}>
        <Eye className="h-4 w-4" /> View
      </Button>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Buy Requests" description="Customer purchase inquiries submitted from product pages." />
      <DataTable columns={columns} rows={data?.requests ?? []} loading={loading} emptyTitle="No buy requests yet" emptyDescription="Requests submitted from your product pages will show up here." />

      {openId && (
        <BuyRequestDetailModal
          requestId={openId}
          canRefer={canRefer}
          onClose={closeDetail}
          onChanged={refetch}
        />
      )}
    </div>
  );
}

export default function BuyRequestsPage() {
  return (
    <Suspense>
      <BuyRequestsInner />
    </Suspense>
  );
}
