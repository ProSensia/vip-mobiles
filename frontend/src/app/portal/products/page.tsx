"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProductStatusBadge, ConditionBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select, Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { CatalogGridSkeleton } from "@/components/ui/Skeleton";
import { RecordSaleModal } from "@/components/portal/RecordSaleModal";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { formatCurrency } from "@/lib/utils";

export default function PortalProductsPage() {
  const [status, setStatus] = useState("AVAILABLE");
  const [q, setQ] = useState("");
  const { data, loading, refetch } = useFetch<{ items: any[] }>(`/products?limit=50&status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`, [status, q]);
  const [saleProduct, setSaleProduct] = useState<any | null>(null);

  async function markStatus(id: string, newStatus: string) {
    try {
      await clientApi.patch(`/products/${id}/status`, { status: newStatus });
      toast.success(`Marked as ${newStatus.toLowerCase()}`);
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not update status");
    }
  }

  return (
    <div>
      <PageHeader title="Products" description="Update stock status or record a sale." />

      <div className="mb-4 flex gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="max-w-xs" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="AVAILABLE">Available</option>
          <option value="RESERVED">Reserved</option>
          <option value="SOLD">Sold</option>
        </Select>
      </div>

      {loading ? (
        <CatalogGridSkeleton />
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No products found" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data!.items.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl2 border border-ink-600 bg-ink-800/60">
              <div className="relative aspect-square bg-ink-900">
                {p.images[0] && <Image src={p.images[0].webpUrl || p.images[0].url} alt={p.title} fill className="object-cover" />}
              </div>
              <div className="p-3">
                <p className="line-clamp-1 text-sm font-medium text-cream">{p.title}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <ConditionBadge condition={p.condition} />
                  <ProductStatusBadge status={p.status} />
                </div>
                <p className="mt-1.5 font-display text-sm font-bold text-gold-400">{formatCurrency(p.basePrice)}</p>
                <div className="mt-3 flex gap-1.5">
                  {p.status === "AVAILABLE" && (
                    <>
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => markStatus(p.id, "RESERVED")}>Reserve</Button>
                      <Button size="sm" className="flex-1" onClick={() => setSaleProduct(p)}>Sell</Button>
                    </>
                  )}
                  {p.status === "RESERVED" && (
                    <>
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => markStatus(p.id, "AVAILABLE")}>Release</Button>
                      <Button size="sm" className="flex-1" onClick={() => setSaleProduct(p)}>Sell</Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {saleProduct && <RecordSaleModal product={saleProduct} onClose={() => setSaleProduct(null)} onDone={refetch} />}
    </div>
  );
}
