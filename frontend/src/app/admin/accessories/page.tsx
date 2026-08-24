"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ProductStatusBadge, ConditionBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { formatCurrency } from "@/lib/utils";

interface ProductRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  condition: string;
  basePrice: string;
  brand: { name: string };
  category: { name: string };
  images: Array<{ thumbUrl?: string | null; webpUrl?: string | null; url: string }>;
}

// Accessories share the exact same Product/catalog infrastructure as phones
// — this is just the Products list pre-filtered to categories marked
// isAccessory, with its own dedicated menu entry. Add/Edit reuses the same
// product form (its category dropdown already includes accessory
// categories), so there's no separate accessory schema to maintain.
export default function AccessoriesPage() {
  const [q, setQ] = useState("");
  const { data, loading, refetch } = useFetch<{ items: ProductRow[] }>(
    `/products?limit=50&accessory=1${q ? `&q=${encodeURIComponent(q)}` : ""}`,
    [q]
  );
  const { confirm, dialog } = useConfirmDialog();

  async function handleDelete(p: ProductRow) {
    const ok = await confirm({ title: "Delete Accessory", description: `Delete "${p.title}"? This can't be undone.`, destructive: true, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await clientApi.delete(`/products/${p.id}`);
      toast.success("Accessory deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not delete accessory");
    }
  }

  const columns: Column<ProductRow>[] = [
    { key: "image", header: "", render: (p) => (
      <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-ink-900">
        {p.images[0] && <Image src={p.images[0].thumbUrl || p.images[0].webpUrl || p.images[0].url} alt="" fill className="object-cover" />}
      </div>
    ) },
    { key: "title", header: "Accessory", render: (p) => (
      <div>
        <p className="font-medium">{p.title}</p>
        <p className="text-xs text-muted">{p.brand.name} · {p.category.name}</p>
      </div>
    ) },
    { key: "price", header: "Price", render: (p) => formatCurrency(p.basePrice) },
    { key: "condition", header: "Condition", render: (p) => <ConditionBadge condition={p.condition} /> },
    { key: "status", header: "Status", render: (p) => <ProductStatusBadge status={p.status} /> },
    {
      key: "actions", header: "", className: "text-right",
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Link href={`/admin/products/${p.id}`}><Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button></Link>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(p)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Accessories"
        description="Cases, chargers, earphones and other accessories — mark a category as an accessory category to have it appear here."
        action={<Link href="/admin/products/new"><Button><Plus className="h-4 w-4" /> Add Accessory</Button></Link>}
      />

      <div className="mb-4 relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accessories..." className="pl-9" />
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        loading={loading}
        emptyTitle="No accessories yet"
        emptyDescription='Mark a category as "Accessory" in Categories, then add products under it — they will show up here.'
      />
      {dialog}
    </div>
  );
}
