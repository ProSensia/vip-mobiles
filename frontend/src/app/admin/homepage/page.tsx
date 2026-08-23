"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff, ArrowUp, ArrowDown } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, FormField, Select, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";

const TYPE_LABELS: Record<string, string> = {
  FEATURED_PRODUCTS: "Featured Products",
  NEW_ARRIVALS: "New Arrivals",
  FEATURED_CATEGORIES: "Featured Categories",
  SELECTED_PRODUCTS: "Selected Products",
  BANNER: "Banner Strip",
  BRANCHES: "Branches",
  CUSTOM_HTML: "Custom Text Block",
};

interface Section {
  id: string;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  isVisible: boolean;
  sortOrder: number;
  config: any;
}

export default function HomepagePage() {
  const { data, loading, refetch } = useFetch<{ sections: Section[] }>("/homepage-sections?all=1");
  const { confirm, dialog } = useConfirmDialog();
  const [modalOpen, setModalOpen] = useState(false);
  const sections = (data?.sections ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  async function toggleVisible(section: Section) {
    await clientApi.patch(`/homepage-sections/${section.id}`, { isVisible: !section.isVisible });
    refetch();
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...sections];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await clientApi.patch("/homepage-sections/reorder", { order: next.map((s) => s.id) });
    refetch();
  }

  async function handleDelete(section: Section) {
    const ok = await confirm({ title: "Remove Section", description: "Remove this section from the homepage?", destructive: true, confirmLabel: "Remove" });
    if (!ok) return;
    try {
      await clientApi.delete(`/homepage-sections/${section.id}`);
      toast.success("Section removed");
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not remove section");
    }
  }

  return (
    <div>
      <PageHeader
        title="Homepage"
        description="Control which sections appear on your homepage, their order and visibility."
        action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Section</Button>}
      />

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : sections.length === 0 ? (
        <EmptyState title="No homepage sections yet" description="Add featured products, new arrivals or category blocks to build your homepage." />
      ) : (
        <div className="space-y-3">
          {sections.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between gap-4 rounded-xl2 border border-ink-600 bg-ink-800/60 p-4">
              <div>
                <p className="font-medium text-cream">{s.title || TYPE_LABELS[s.type]}</p>
                <p className="text-xs text-muted">{TYPE_LABELS[s.type]}{s.subtitle ? ` — ${s.subtitle}` : ""}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === sections.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => toggleVisible(s)}>
                  {s.isVisible ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4 text-muted" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(s)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && <SectionFormModal onClose={() => setModalOpen(false)} onSaved={refetch} />}
      {dialog}
    </div>
  );
}

function SectionFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState("FEATURED_PRODUCTS");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [limit, setLimit] = useState(9);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const config = type === "FEATURED_PRODUCTS" || type === "NEW_ARRIVALS" ? { limit } : type === "CUSTOM_HTML" ? { body } : {};
      await clientApi.post("/homepage-sections", { type, title: title || undefined, subtitle: subtitle || undefined, config, isVisible: true });
      toast.success("Section added");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not add section");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Homepage Section">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Section Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </FormField>
        <FormField label="Title (optional)"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></FormField>
        <FormField label="Subtitle (optional)"><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></FormField>
        {(type === "FEATURED_PRODUCTS" || type === "NEW_ARRIVALS") && (
          <FormField label="Number of products to show"><Input type="number" min={1} max={12} value={limit} onChange={(e) => setLimit(Number(e.target.value))} /></FormField>
        )}
        {type === "CUSTOM_HTML" && (
          <FormField label="Text Content"><Textarea value={body} onChange={(e) => setBody(e.target.value)} /></FormField>
        )}
        <Button type="submit" className="w-full" loading={saving}>Add Section</Button>
      </form>
    </Modal>
  );
}
