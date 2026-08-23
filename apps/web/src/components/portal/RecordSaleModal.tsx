"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Input, FormField, Textarea, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { formatCurrency } from "@/lib/utils";
import { useFetch } from "@/lib/useFetch";

export function RecordSaleModal({ product: productRow, onClose, onDone }: { product: any; onClose: () => void; onDone: () => void }) {
  const { data } = useFetch<{ product: any }>(`/products/by-id/${productRow.id}`);
  const product = data?.product ?? productRow;
  const [variantId, setVariantId] = useState("");
  const [soldPrice, setSoldPrice] = useState(String(productRow.basePrice));
  const [costPrice, setCostPrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product.variants?.length && !variantId) {
      const def = product.variants.find((v: any) => v.isDefault) ?? product.variants[0];
      setVariantId(def.id);
      setSoldPrice(String(def.price));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.variants]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await clientApi.post("/sales", {
        productId: product.id,
        variantId: variantId || undefined,
        soldPrice: Number(soldPrice),
        costPrice: costPrice ? Number(costPrice) : undefined,
        customerName: customerName || undefined,
        customerContact: customerContact || undefined,
        notes: notes || undefined,
      });
      toast.success("Sale recorded — product marked as sold");
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not record sale");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Record Sale — ${product.title}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {product.variants?.length > 0 && (
          <FormField label="Variant">
            <Select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              {product.variants.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {[v.color?.name, v.storage].filter(Boolean).join(" / ") || "Default"} — {formatCurrency(v.price)}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Sold Price"><Input type="number" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} required /></FormField>
          <FormField label="Cost Price (optional)" hint="For profit tracking"><Input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} /></FormField>
        </div>
        <FormField label="Customer Name (optional)"><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></FormField>
        <FormField label="Customer Contact (optional)"><Input value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} /></FormField>
        <FormField label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
        <Button type="submit" className="w-full" loading={saving}>Confirm Sale</Button>
      </form>
    </Modal>
  );
}
