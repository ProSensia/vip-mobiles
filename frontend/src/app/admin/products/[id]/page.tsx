"use client";

import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Save, Plus, Trash2, ExternalLink, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input, FormField, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ProductStatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ImagesManager } from "@/components/admin/product/ImagesManager";
import { UnitsManager } from "@/components/admin/product/UnitsManager";
import { VariantsManager } from "@/components/admin/product/VariantsManager";
import { VideosManager } from "@/components/admin/product/VideosManager";
import { ReviewsManager } from "@/components/admin/product/ReviewsManager";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, refetch } = useFetch<{ product: any }>(`/products/by-id/${id}`);
  const { data: brandsData } = useFetch<{ brands: any[] }>("/brands?all=1");
  const { data: categoriesData } = useFetch<{ categories: any[] }>("/categories?all=1");
  const product = data?.product;

  const [form, setForm] = useState<any>(null);
  const [specs, setSpecs] = useState<Array<{ label: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        title: product.title,
        brandId: product.brandId,
        categoryId: product.categoryId,
        condition: product.condition,
        basePrice: product.basePrice,
        compareAtPrice: product.compareAtPrice ?? "",
        description: product.description ?? "",
        boxAvailable: product.boxAvailable,
        isFeatured: product.isFeatured,
        isNewArrival: product.isNewArrival,
        isTrending: product.isTrending,
        isBestSeller: product.isBestSeller,
        isPtaApproved: product.isPtaApproved,
        metaTitle: product.metaTitle ?? "",
        metaDescription: product.metaDescription ?? "",
      });
      setSpecs(product.specifications ?? []);
    }
  }, [product]);

  function set<K extends string>(key: K, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await clientApi.patch(`/products/${id}`, {
        ...form,
        basePrice: Number(form.basePrice),
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
        specifications: specs.filter((s) => s.label && s.value),
      });
      toast.success("Product saved");
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: string) {
    try {
      await clientApi.patch(`/products/${id}/status`, { status });
      toast.success(`Marked as ${status.toLowerCase()}`);
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not update status");
    }
  }

  if (loading || !form) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-24" />
        </div>
        <Card>
          <CardBody className="space-y-4 py-6">
            <Skeleton className="h-9 w-full" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-24 w-full" />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-6">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={product.title}
        description="Manage product details, images, variants, videos and reviews."
        action={
          <div className="flex items-center gap-2">
            <ProductStatusBadge status={product.status} />
            <Link href={`/product/${product.slug}`} target="_blank"><Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" /> View</Button></Link>
          </div>
        }
      />

      <Card>
        <CardHeader title="Stock Status" subtitle="Update instantly — sold items are removed from featured/available listings automatically." />
        <CardBody className="flex flex-wrap gap-2">
          {["AVAILABLE", "RESERVED", "SOLD", "HIDDEN"].map((s) => (
            <Button key={s} size="sm" variant={product.status === s ? "primary" : "secondary"} onClick={() => changeStatus(s)}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </Button>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Details" />
        <CardBody>
          <form onSubmit={handleSave} className="space-y-4">
            <FormField label="Title"><Input value={form.title} onChange={(e) => set("title", e.target.value)} required /></FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Brand">
                <Select value={form.brandId} onChange={(e) => set("brandId", e.target.value)}>
                  {brandsData?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Category">
                <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                  {categoriesData?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Condition">
                <Select value={form.condition} onChange={(e) => set("condition", e.target.value)}>
                  <option value="NEW">New</option>
                  <option value="USED">Used</option>
                  <option value="REFURBISHED">Refurbished</option>
                  <option value="OPEN_BOX">Open Box</option>
                </Select>
              </FormField>
              <FormField label="Base Price"><Input type="number" value={form.basePrice} onChange={(e) => set("basePrice", e.target.value)} required /></FormField>
              <FormField label="Compare-at Price (optional)"><Input type="number" value={form.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value)} /></FormField>
            </div>
            <FormField label="Description"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={5} /></FormField>

            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm text-cream">
                <input type="checkbox" checked={form.boxAvailable} onChange={(e) => set("boxAvailable", e.target.checked)} className="h-4 w-4 rounded border-ink-600 accent-gold-500" /> Box available
              </label>
              <label className="flex items-center gap-2 text-sm text-cream">
                <input type="checkbox" checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} className="h-4 w-4 rounded border-ink-600 accent-gold-500" /> Featured
              </label>
              <label className="flex items-center gap-2 text-sm text-cream">
                <input type="checkbox" checked={form.isNewArrival} onChange={(e) => set("isNewArrival", e.target.checked)} className="h-4 w-4 rounded border-ink-600 accent-gold-500" /> New Arrival
              </label>
              <label className="flex items-center gap-2 text-sm text-cream">
                <input type="checkbox" checked={form.isTrending} onChange={(e) => set("isTrending", e.target.checked)} className="h-4 w-4 rounded border-ink-600 accent-gold-500" /> Trending / Hot Deal
              </label>
              <label className="flex items-center gap-2 text-sm text-cream">
                <input type="checkbox" checked={form.isBestSeller} onChange={(e) => set("isBestSeller", e.target.checked)} className="h-4 w-4 rounded border-ink-600 accent-gold-500" /> Best Seller
              </label>
              <label className="flex items-center gap-2 text-sm text-cream">
                <input type="checkbox" checked={form.isPtaApproved} onChange={(e) => set("isPtaApproved", e.target.checked)} className="h-4 w-4 rounded border-ink-600 accent-gold-500" /> PTA Approved
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-cream">Specifications</p>
              <div className="space-y-2">
                {specs.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Label (e.g. Display)" value={s.label} onChange={(e) => setSpecs((arr) => arr.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x))} />
                    <Input placeholder="Value" value={s.value} onChange={(e) => setSpecs((arr) => arr.map((x, xi) => xi === i ? { ...x, value: e.target.value } : x))} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setSpecs((arr) => arr.filter((_, xi) => xi !== i))}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setSpecs((arr) => [...arr, { label: "", value: "" }])}><Plus className="h-4 w-4" /> Add Spec</Button>
              </div>
            </div>

            <details className="rounded-xl border border-ink-600 p-3">
              <summary className="cursor-pointer text-sm font-medium text-cream">SEO (optional)</summary>
              <div className="mt-3 space-y-3">
                <FormField label="Meta Title"><Input value={form.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} /></FormField>
                <FormField label="Meta Description"><Textarea value={form.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} /></FormField>
              </div>
            </details>

            <Button type="submit" loading={saving}><Save className="h-4 w-4" /> Save Product</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Images" subtitle="Automatically optimized to WebP/AVIF on upload. Drag to reorder." />
        <CardBody><ImagesManager productId={id} images={product.images} onChange={refetch} /></CardBody>
      </Card>

      <Card>
        <CardHeader title="Variants" subtitle="Color and storage combinations with their own price and stock." />
        <CardBody><VariantsManager productId={id} variants={product.variants} onChange={refetch} /></CardBody>
      </Card>

      <Card>
        <CardHeader title="Inventory Units (IMEI / QR)" subtitle="Scan in each physical phone individually — selling one only affects that unit." />
        <CardBody><UnitsManager productId={id} /></CardBody>
      </Card>

      <Card>
        <CardHeader title="Social Video Reviews" subtitle="Add TikTok, Instagram or YouTube links — they'll embed automatically on the product page." />
        <CardBody><VideosManager productId={id} videos={product.videos} onChange={refetch} /></CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Reviews"
          action={<Link href={`/admin/social?productId=${id}`} className="flex items-center gap-1 text-xs font-medium text-gold-400 hover:underline"><Sparkles className="h-3.5 w-3.5" /> Generate Social Post</Link>}
        />
        <CardBody><ReviewsManager productId={id} reviews={product.reviews} onChange={refetch} /></CardBody>
      </Card>
    </div>
  );
}
