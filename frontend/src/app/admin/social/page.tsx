"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Sparkles, Download, LayoutTemplate, Zap } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { cn } from "@/lib/utils";

const TOGGLES = [
  { key: "showLogo", label: "Store Logo" },
  { key: "showPrice", label: "Price" },
  { key: "showBadges", label: "Badges (discount, stock, etc.)" },
  { key: "showDescription", label: "Description" },
  { key: "showCTA", label: "Call to Action" },
  { key: "showSupportingImages", label: "Supporting Images" },
] as const;

const FORMATS = [
  { id: "square", platform: "INSTAGRAM", format: "square", label: "Square Post", hint: "Instagram / Facebook feed · 1:1" },
  { id: "portrait", platform: "INSTAGRAM", format: "portrait", label: "Portrait Post", hint: "Instagram / Facebook feed · 4:5" },
  { id: "story", platform: "TIKTOK", format: "story", label: "Story / Status", hint: "Instagram/FB Story, WhatsApp Status, TikTok · 9:16" },
] as const;

type FormatId = (typeof FORMATS)[number]["id"];

const TEMPLATES: Array<{ id: "classic" | "bold"; label: string; hint: string; availableFor: FormatId[] }> = [
  { id: "classic", label: "Classic", hint: "Photo + details side by side", availableFor: ["square", "portrait", "story"] },
  { id: "bold", label: "Bold", hint: "Centered, price-forward", availableFor: ["square"] },
];

function SocialGeneratorInner() {
  const searchParams = useSearchParams();
  const { data: productsData } = useFetch<{ items: any[] }>("/products?limit=60&status=AVAILABLE");
  const { data: gradientsData } = useFetch<{ gradients: any[] }>("/social/gradients");

  const [productId, setProductId] = useState(searchParams.get("productId") ?? "");
  const [imageId, setImageId] = useState("");
  const [formatId, setFormatId] = useState<FormatId>("square");
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["id"]>("classic");
  const [gradientId, setGradientId] = useState("");
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    showLogo: true, showPrice: true, showBadges: true, showDescription: false, showCTA: true, showSupportingImages: true,
  });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ imageUrl: string } | null>(null);

  const { data: productDetail } = useFetch<{ product: any }>(productId ? `/products/by-id/${productId}` : null, [productId]);
  const images: any[] = productDetail?.product?.images ?? [];

  useEffect(() => {
    if (images.length > 0 && !images.some((i) => i.id === imageId)) {
      setImageId(images.find((i) => i.isPrimary)?.id ?? images[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, images.length]);

  useEffect(() => {
    const active = TEMPLATES.find((t) => t.id === template);
    if (active && !active.availableFor.includes(formatId)) setTemplate("classic");
  }, [formatId, template]);

  const { data: historyData, refetch: refetchHistory } = useFetch<{ creatives: any[] }>(
    productId ? `/social/history/${productId}` : null,
    [productId]
  );

  async function handleGenerate() {
    if (!productId) {
      toast.error("Please select a product");
      return;
    }
    const chosenFormat = FORMATS.find((f) => f.id === formatId)!;
    setGenerating(true);
    try {
      const { creative } = await clientApi.post<{ creative: any }>("/social/generate", {
        productId,
        imageId: imageId || undefined,
        platform: chosenFormat.platform,
        format: chosenFormat.format,
        template,
        gradientId: gradientId || undefined,
        ...toggles,
      });
      setResult(creative);
      refetchHistory();
      toast.success("Creative generated");
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not generate creative");
    } finally {
      setGenerating(false);
    }
  }

  const activeTemplateOptions = TEMPLATES.filter((t) => t.availableFor.includes(formatId));

  return (
    <div>
      <PageHeader title="Social Media Studio" description="Create professional, on-brand marketing posts from any product — badges, pricing and branding composed automatically." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Create a Post" />
          <CardBody className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-medium text-cream">Product</p>
              <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select a product</option>
                {productsData?.items.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </div>

            {images.length > 1 && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-cream">Hero Image</p>
                <div className="grid grid-cols-5 gap-2">
                  {images.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => setImageId(img.id)}
                      className={cn("relative aspect-square overflow-hidden rounded-lg border-2", imageId === img.id ? "border-gold-500" : "border-ink-600")}
                    >
                      <Image src={img.thumbUrl || img.webpUrl || img.url} alt="" fill className="object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-cream"><Zap className="h-3.5 w-3.5" /> Format</p>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormatId(f.id)}
                    title={f.hint}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors",
                      formatId === f.id ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-600 text-cream hover:border-gold-500/40"
                    )}
                  >
                    <span className="block text-sm font-semibold">{f.label}</span>
                    <span className="mt-0.5 block text-[10px] text-muted">{f.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {activeTemplateOptions.length > 1 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-cream"><LayoutTemplate className="h-3.5 w-3.5" /> Template</p>
                <div className="grid grid-cols-2 gap-2">
                  {activeTemplateOptions.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTemplate(t.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors",
                        template === t.id ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-600 text-cream hover:border-gold-500/40"
                      )}
                    >
                      <span className="block text-sm font-semibold">{t.label}</span>
                      <span className="mt-0.5 block text-[10px] text-muted">{t.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-sm font-medium text-cream">Background Style</p>
              <div className="grid grid-cols-4 gap-2">
                {gradientsData?.gradients.map((g: any) => (
                  <button
                    key={g.id}
                    onClick={() => setGradientId(g.id)}
                    className={cn("h-10 rounded-lg border-2", gradientId === g.id ? "border-gold-500" : "border-transparent")}
                    style={{ background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }}
                    title={g.id}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-cream">Elements</p>
              <p className="mb-2 text-xs text-muted">Discount, New Arrival, Hot Deal, Best Seller, Limited Stock and PTA Approved badges are added automatically based on the product&apos;s status.</p>
              <div className="grid grid-cols-2 gap-2">
                {TOGGLES.map((t) => (
                  <label key={t.key} className="flex items-center gap-2 text-sm text-cream">
                    <input
                      type="checkbox"
                      checked={toggles[t.key]}
                      onChange={(e) => setToggles((s) => ({ ...s, [t.key]: e.target.checked }))}
                      className="h-4 w-4 rounded border-ink-600 accent-gold-500"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={handleGenerate} loading={generating}>
              <Sparkles className="h-4 w-4" /> Generate Creative
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Preview" subtitle="Download the image to post manually or edit further." />
          <CardBody>
            {result ? (
              <div className="space-y-3">
                <div className="relative mx-auto max-w-xs overflow-hidden rounded-xl border border-ink-600">
                  <Image src={result.imageUrl} alt="Generated creative" width={500} height={500} className="w-full" />
                </div>
                <a href={result.imageUrl} download target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full"><Download className="h-4 w-4" /> Download Image</Button>
                </a>
              </div>
            ) : (
              <p className="text-center text-sm text-muted">Your generated creative will appear here.</p>
            )}

            {historyData && historyData.creatives.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium text-cream">Recent Creatives</p>
                <div className="grid grid-cols-4 gap-2">
                  {historyData.creatives.slice(0, 8).map((c: any) => (
                    <button key={c.id} onClick={() => setResult(c)} className="relative aspect-square overflow-hidden rounded-lg border border-ink-600">
                      <Image src={c.imageUrl} alt="" fill className="object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function SocialGeneratorPage() {
  return (
    <Suspense>
      <SocialGeneratorInner />
    </Suspense>
  );
}
