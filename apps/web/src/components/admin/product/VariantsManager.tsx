"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { formatCurrency } from "@/lib/utils";

interface Variant {
  id: string;
  storage?: string | null;
  ram?: string | null;
  price: string;
  stockQty: number;
  status: string;
  isDefault: boolean;
  color?: { id: string; name: string; hexCode: string } | null;
}

export function VariantsManager({ productId, variants, onChange }: { productId: string; variants: Variant[]; onChange: () => void }) {
  const { data: colorsData } = useFetch<{ colors: any[] }>("/colors");
  const [form, setForm] = useState({ colorId: "", storage: "", ram: "", price: "", stockQty: "1" });
  const [saving, setSaving] = useState(false);

  async function addVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!form.price) {
      toast.error("Please enter a price");
      return;
    }
    setSaving(true);
    try {
      await clientApi.post(`/products/${productId}/variants`, {
        colorId: form.colorId || undefined,
        storage: form.storage || undefined,
        ram: form.ram || undefined,
        price: Number(form.price),
        stockQty: Number(form.stockQty),
        isDefault: variants.length === 0,
      });
      toast.success("Variant added");
      setForm({ colorId: "", storage: "", ram: "", price: "", stockQty: "1" });
      onChange();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not add variant");
    } finally {
      setSaving(false);
    }
  }

  async function removeVariant(id: string) {
    await clientApi.delete(`/products/${productId}/variants/${id}`);
    toast.success("Variant removed");
    onChange();
  }

  async function updateStock(id: string, stockQty: number) {
    await clientApi.patch(`/products/${productId}/variants/${id}`, { stockQty });
    onChange();
  }

  return (
    <div className="space-y-4">
      {variants.length > 0 && (
        <div className="space-y-2">
          {variants.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-800/40 p-3">
              <div className="flex items-center gap-2 text-sm text-cream">
                {v.color && <span className="h-4 w-4 rounded-full border border-ink-600" style={{ backgroundColor: v.color.hexCode }} />}
                <span>{[v.color?.name, v.storage, v.ram].filter(Boolean).join(" / ") || "Default"}</span>
                {v.isDefault && <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-xs text-gold-400">Default</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gold-400">{formatCurrency(v.price)}</span>
                <Input
                  type="number"
                  defaultValue={v.stockQty}
                  onBlur={(e) => updateStock(v.id, Number(e.target.value))}
                  className="h-8 w-20 text-xs"
                />
                <button onClick={() => removeVariant(v.id)}><Trash2 className="h-4 w-4 text-red-400" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addVariant} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Select value={form.colorId} onChange={(e) => setForm((f) => ({ ...f, colorId: e.target.value }))}>
          <option value="">No color</option>
          {colorsData?.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input placeholder="Storage (128GB)" value={form.storage} onChange={(e) => setForm((f) => ({ ...f, storage: e.target.value }))} />
        <Input placeholder="RAM (optional)" value={form.ram} onChange={(e) => setForm((f) => ({ ...f, ram: e.target.value }))} />
        <Input type="number" placeholder="Price" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
        <div className="flex gap-2">
          <Input type="number" placeholder="Stock" value={form.stockQty} onChange={(e) => setForm((f) => ({ ...f, stockQty: e.target.value }))} />
          <Button type="submit" size="icon" loading={saving}><Plus className="h-4 w-4" /></Button>
        </div>
      </form>
    </div>
  );
}
