"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, FormField, Select } from "@/components/ui/Input";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";

interface Banner {
  id: string;
  title?: string | null;
  imageUrl: string;
  placement: string;
  isActive: boolean;
}

export default function BannersPage() {
  const { data, loading, refetch } = useFetch<{ banners: Banner[] }>("/banners?all=1");
  const { confirm, dialog } = useConfirmDialog();
  const [modalOpen, setModalOpen] = useState(false);

  async function toggleActive(banner: Banner) {
    await clientApi.patch(`/banners/${banner.id}`, { isActive: !banner.isActive });
    refetch();
  }

  async function handleDelete(banner: Banner) {
    const ok = await confirm({ title: "Delete Banner", description: "Remove this banner?", destructive: true, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await clientApi.delete(`/banners/${banner.id}`);
      toast.success("Banner deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not delete banner");
    }
  }

  return (
    <div>
      <PageHeader title="Banners" description="Promotional banners shown on the homepage and catalog." action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Banner</Button>} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : (data?.banners ?? []).length === 0 ? (
        <EmptyState title="No banners yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data!.banners.map((b) => (
            <div key={b.id} className="overflow-hidden rounded-xl2 border border-ink-600 bg-ink-800/60">
              <div className="relative aspect-[16/6]">
                <Image src={b.imageUrl} alt={b.title || ""} fill className="object-cover" />
              </div>
              <div className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium text-cream">{b.title || "Untitled"}</p>
                  <p className="text-xs text-muted">{b.placement.replace(/_/g, " ")}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(b)}>
                    {b.isActive ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4 text-muted" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(b)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && <BannerFormModal onClose={() => setModalOpen(false)} onSaved={refetch} />}
      {dialog}
    </div>
  );
}

function BannerFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [link, setLink] = useState("");
  const [placement, setPlacement] = useState("HOME_HERO");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageUrl) {
      toast.error("Please upload a banner image");
      return;
    }
    setSaving(true);
    try {
      await clientApi.post("/banners", { title: title || undefined, imageUrl, link: link || undefined, placement, isActive: true });
      toast.success("Banner added");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not save banner");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Banner">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Banner Image (recommended 1600×600)">
          <ImageUploader folder="banners" value={imageUrl} onChange={setImageUrl} aspect="aspect-[16/6]" />
        </FormField>
        <FormField label="Title (optional)"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></FormField>
        <FormField label="Link (optional)"><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/catalog" /></FormField>
        <FormField label="Placement">
          <Select value={placement} onChange={(e) => setPlacement(e.target.value)}>
            <option value="HOME_HERO">Homepage Hero</option>
            <option value="HOME_STRIP">Homepage Strip</option>
            <option value="CATALOG_TOP">Catalog Top</option>
          </Select>
        </FormField>
        <Button type="submit" className="w-full" loading={saving}>Save Banner</Button>
      </form>
    </Modal>
  );
}
