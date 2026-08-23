"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, FormField } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";

interface Color {
  id: string;
  name: string;
  hexCode: string;
}

export default function ColorsPage() {
  const { data, loading, refetch } = useFetch<{ colors: Color[] }>("/colors");
  const { confirm, dialog } = useConfirmDialog();
  const [modalOpen, setModalOpen] = useState(false);

  async function handleDelete(color: Color) {
    const ok = await confirm({ title: "Delete Color", description: `Delete "${color.name}"?`, destructive: true, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await clientApi.delete(`/colors/${color.id}`);
      toast.success("Color deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not delete color");
    }
  }

  return (
    <div>
      <PageHeader title="Colors" description="Manage the color options available for product variants." action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Color</Button>} />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (data?.colors ?? []).length === 0 ? (
        <EmptyState title="No colors yet" description="Add colors to offer as product variants." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data!.colors.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl2 border border-ink-600 bg-ink-800/60 p-3">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 rounded-full border border-ink-600" style={{ backgroundColor: c.hexCode }} />
                <span className="text-sm font-medium text-cream">{c.name}</span>
              </div>
              <button onClick={() => handleDelete(c)}><Trash2 className="h-4 w-4 text-red-400" /></button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <ColorFormModal
          onClose={() => setModalOpen(false)}
          onSaved={refetch}
        />
      )}
      {dialog}
    </div>
  );
}

function ColorFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [hexCode, setHexCode] = useState("#000000");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await clientApi.post("/colors", { name, hexCode });
      toast.success("Color added");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not save color");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Color">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Midnight Black" required autoFocus /></FormField>
        <FormField label="Color">
          <div className="flex items-center gap-3">
            <input type="color" value={hexCode} onChange={(e) => setHexCode(e.target.value)} className="h-10 w-14 rounded-lg border border-ink-600 bg-ink-800" />
            <Input value={hexCode} onChange={(e) => setHexCode(e.target.value)} className="flex-1" />
          </div>
        </FormField>
        <Button type="submit" className="w-full" loading={saving}>Save Color</Button>
      </form>
    </Modal>
  );
}
