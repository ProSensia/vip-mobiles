"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Input, FormField, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";

export default function NewProductPage() {
  const router = useRouter();
  const { data: brandsData } = useFetch<{ brands: any[] }>("/brands?all=1");
  const { data: categoriesData } = useFetch<{ categories: any[] }>("/categories?all=1");

  const [form, setForm] = useState({
    title: "",
    brandId: "",
    categoryId: "",
    condition: "USED",
    basePrice: "",
    description: "",
    boxAvailable: false,
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.brandId || !form.categoryId) {
      toast.error("Please select a brand and category");
      return;
    }
    setSaving(true);
    try {
      const { product } = await clientApi.post<{ product: any }>("/products", {
        ...form,
        basePrice: Number(form.basePrice),
      });
      toast.success("Product created — now add images and variants");
      router.push(`/admin/products/${product.id}`);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not create product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add Product" description="Start with the basics — you can add images, variants and videos next." />
      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Title"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Apple iPhone 14 Pro" required autoFocus /></FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Brand">
                <Select value={form.brandId} onChange={(e) => set("brandId", e.target.value)} required>
                  <option value="">Select brand</option>
                  {brandsData?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Category">
                <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} required>
                  <option value="">Select category</option>
                  {categoriesData?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Condition">
                <Select value={form.condition} onChange={(e) => set("condition", e.target.value)}>
                  <option value="NEW">New</option>
                  <option value="USED">Used</option>
                  <option value="REFURBISHED">Refurbished</option>
                  <option value="OPEN_BOX">Open Box</option>
                </Select>
              </FormField>
              <FormField label="Base Price"><Input type="number" value={form.basePrice} onChange={(e) => set("basePrice", e.target.value)} required /></FormField>
            </div>
            <FormField label="Description"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></FormField>
            <label className="flex items-center gap-2 text-sm text-cream">
              <input type="checkbox" checked={form.boxAvailable} onChange={(e) => set("boxAvailable", e.target.checked)} className="h-4 w-4 rounded border-ink-600 accent-gold-500" />
              Box available
            </label>
            <Button type="submit" className="w-full" loading={saving}>Create Product</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
