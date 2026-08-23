"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, FormField, Textarea } from "@/components/ui/Input";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";

interface Brand {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  _count: { products: number };
}

export default function BrandsPage() {
  const { data, loading, refetch } = useFetch<{ brands: Brand[] }>("/brands?all=1");
  const { confirm, dialog } = useConfirmDialog();
  const [editing, setEditing] = useState<Brand | null | "new">(null);

  async function handleDelete(brand: Brand) {
    const ok = await confirm({
      title: "Delete Brand",
      description: `Delete "${brand.name}"? This can't be undone.`,
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await clientApi.delete(`/brands/${brand.id}`);
      toast.success("Brand deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not delete brand");
    }
  }

  const columns: Column<Brand>[] = [
    { key: "name", header: "Brand", render: (b) => <span className="font-medium">{b.name}</span> },
    { key: "products", header: "Products", render: (b) => b._count.products },
    { key: "status", header: "Status", render: (b) => (b.isActive ? "Active" : "Inactive") },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (b) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(b)}><Pencil className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(b)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Brands"
        description="Manage the phone brands shown across your catalog."
        action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add Brand</Button>}
      />
      <DataTable columns={columns} rows={data?.brands ?? []} loading={loading} emptyTitle="No brands yet" emptyDescription="Add your first brand to start building the catalog." />
      {editing && <BrandFormModal brand={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refetch} />}
      {dialog}
    </div>
  );
}

function BrandFormModal({ brand, onClose, onSaved }: { brand: Brand | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(brand?.name ?? "");
  const [description, setDescription] = useState(brand?.description ?? "");
  const [isActive, setIsActive] = useState(brand?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (brand) await clientApi.patch(`/brands/${brand.id}`, { name, description, isActive });
      else await clientApi.post("/brands", { name, description, isActive });
      toast.success(brand ? "Brand updated" : "Brand created");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not save brand");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={brand ? "Edit Brand" : "Add Brand"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></FormField>
        <FormField label="Description (optional)"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></FormField>
        <label className="flex items-center gap-2 text-sm text-cream">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-ink-600 accent-gold-500" />
          Active (visible on storefront)
        </label>
        <Button type="submit" className="w-full" loading={saving}>Save Brand</Button>
      </form>
    </Modal>
  );
}
