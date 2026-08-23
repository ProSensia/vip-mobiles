"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, FormField } from "@/components/ui/Input";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";

interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
  phone?: string | null;
  whatsapp?: string | null;
  mapUrl?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
}

export default function BranchesPage() {
  const { data, loading, refetch } = useFetch<{ branches: Branch[] }>("/branches?all=1");
  const { confirm, dialog } = useConfirmDialog();
  const [editing, setEditing] = useState<Branch | null | "new">(null);

  async function handleDelete(branch: Branch) {
    const ok = await confirm({ title: "Delete Branch", description: `Delete "${branch.name}"?`, destructive: true, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await clientApi.delete(`/branches/${branch.id}`);
      toast.success("Branch deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not delete branch");
    }
  }

  const columns: Column<Branch>[] = [
    { key: "name", header: "Branch", render: (b) => <span className="font-medium">{b.name}</span> },
    { key: "city", header: "City" },
    { key: "phone", header: "Phone", render: (b) => b.phone || "—" },
    { key: "status", header: "Status", render: (b) => (b.isActive ? "Active" : "Inactive") },
    {
      key: "actions", header: "", className: "text-right",
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
        title="Branches"
        description="Manage store locations, contact details and opening hours."
        action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add Branch</Button>}
      />
      <DataTable columns={columns} rows={data?.branches ?? []} loading={loading} emptyTitle="No branches yet" />
      {editing && <BranchFormModal branch={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refetch} />}
      {dialog}
    </div>
  );
}

function BranchFormModal({ branch, onClose, onSaved }: { branch: Branch | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    city: branch?.city ?? "",
    phone: branch?.phone ?? "",
    whatsapp: branch?.whatsapp ?? "",
    mapUrl: branch?.mapUrl ?? "",
    imageUrl: branch?.imageUrl ?? "",
    monSat: "",
    sun: "",
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        address: form.address,
        city: form.city,
        phone: form.phone || undefined,
        whatsapp: form.whatsapp || undefined,
        mapUrl: form.mapUrl || undefined,
        imageUrl: form.imageUrl || undefined,
        ...(form.monSat || form.sun ? { openingHours: { mon_sat: form.monSat, sun: form.sun } } : {}),
      };
      if (branch) await clientApi.patch(`/branches/${branch.id}`, payload);
      else await clientApi.post("/branches", payload);
      toast.success(branch ? "Branch updated" : "Branch created");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not save branch");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={branch ? "Edit Branch" : "Add Branch"} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Branch Photo">
          <ImageUploader folder="branches" value={form.imageUrl} onChange={(url) => set("imageUrl", url)} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Branch Name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} required /></FormField>
          <FormField label="City"><Input value={form.city} onChange={(e) => set("city", e.target.value)} required /></FormField>
        </div>
        <FormField label="Address"><Input value={form.address} onChange={(e) => set("address", e.target.value)} required /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></FormField>
          <FormField label="WhatsApp Number" hint="Digits with country code"><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></FormField>
        </div>
        <FormField label="Google Maps Link"><Input value={form.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} placeholder="https://maps.google.com/..." /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Hours (Mon–Sat)"><Input value={form.monSat} onChange={(e) => set("monSat", e.target.value)} placeholder="11:00 AM – 9:00 PM" /></FormField>
          <FormField label="Hours (Sunday)"><Input value={form.sun} onChange={(e) => set("sun", e.target.value)} placeholder="2:00 PM – 8:00 PM" /></FormField>
        </div>
        <Button type="submit" className="w-full" loading={saving}>Save Branch</Button>
      </form>
    </Modal>
  );
}
