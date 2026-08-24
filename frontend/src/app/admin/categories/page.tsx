"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, FormField, Textarea } from "@/components/ui/Input";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";

interface Category {
  id: string;
  name: string;
  isActive: boolean;
  isFeatured: boolean;
  isAccessory: boolean;
  _count: { products: number };
}

export default function CategoriesPage() {
  const { data, loading, refetch } = useFetch<{ categories: Category[] }>("/categories?all=1");
  const { confirm, dialog } = useConfirmDialog();
  const [editing, setEditing] = useState<Category | null | "new">(null);

  async function handleDelete(cat: Category) {
    const ok = await confirm({ title: "Delete Category", description: `Delete "${cat.name}"?`, destructive: true, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await clientApi.delete(`/categories/${cat.id}`);
      toast.success("Category deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not delete category");
    }
  }

  const columns: Column<Category>[] = [
    { key: "name", header: "Category", render: (c) => (
      <span className="flex items-center gap-1.5 font-medium">
        {c.name} {c.isFeatured && <Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" />}
        {c.isAccessory && <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">Accessory</span>}
      </span>
    ) },
    { key: "products", header: "Products", render: (c) => c._count.products },
    { key: "status", header: "Status", render: (c) => (c.isActive ? "Active" : "Inactive") },
    {
      key: "actions", header: "", className: "text-right",
      render: (c) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(c)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organize products and choose which categories appear on the homepage."
        action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add Category</Button>}
      />
      <DataTable columns={columns} rows={data?.categories ?? []} loading={loading} emptyTitle="No categories yet" />
      {editing && <CategoryFormModal category={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refetch} />}
      {dialog}
    </div>
  );
}

function CategoryFormModal({ category, onClose, onSaved }: { category: Category | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState((category as any)?.name ?? "");
  const [description, setDescription] = useState((category as any)?.description ?? "");
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(category?.isFeatured ?? false);
  const [isAccessory, setIsAccessory] = useState(category?.isAccessory ?? false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, description, isActive, isFeatured, isAccessory };
      if (category) await clientApi.patch(`/categories/${category.id}`, payload);
      else await clientApi.post("/categories", payload);
      toast.success(category ? "Category updated" : "Category created");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not save category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={category ? "Edit Category" : "Add Category"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></FormField>
        <FormField label="Description (optional)"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></FormField>
        <label className="flex items-center gap-2 text-sm text-cream">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-ink-600 accent-gold-500" /> Active
        </label>
        <label className="flex items-center gap-2 text-sm text-cream">
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="h-4 w-4 rounded border-ink-600 accent-gold-500" /> Featured on homepage
        </label>
        <label className="flex items-center gap-2 text-sm text-cream">
          <input type="checkbox" checked={isAccessory} onChange={(e) => setIsAccessory(e.target.checked)} className="h-4 w-4 rounded border-ink-600 accent-gold-500" /> Accessory category (shows in the Accessories admin catalog)
        </label>
        <Button type="submit" className="w-full" loading={saving}>Save Category</Button>
      </form>
    </Modal>
  );
}
