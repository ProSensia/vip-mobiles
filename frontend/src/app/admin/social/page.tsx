"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Sparkles, Download, Instagram } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { cn } from "@/lib/utils";

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.6 5.82c-.9-.98-1.4-2.26-1.4-3.57h-3.2v13.35c0 1.6-1.3 2.9-2.9 2.9a2.9 2.9 0 1 1 0-5.8c.3 0 .58.04.85.12V9.6a6.1 6.1 0 0 0-.85-.06 6.1 6.1 0 1 0 6.1 6.1V9.06a8.9 8.9 0 0 0 5.1 1.62v-3.2c-1.35 0-2.6-.44-3.6-1.66Z" />
    </svg>
  );
}

const TOGGLES = [
  { key: "showLogo", label: "Store Logo" },
  { key: "showPrice", label: "Price" },
  { key: "showDescription", label: "Description" },
  { key: "showCTA", label: "Call to Action" },
  { key: "showSupportingImages", label: "Supporting Images" },
] as const;

function SocialGeneratorInner() {
  const searchParams = useSearchParams();
  const { data: productsData } = useFetch<{ items: any[] }>("/products?limit=60&status=AVAILABLE");
  const { data: gradientsData } = useFetch<{ gradients: any[] }>("/social/gradients");

  const [productId, setProductId] = useState(searchParams.get("productId") ?? "");
  const [platform, setPlatform] = useState<"INSTAGRAM" | "TIKTOK">("INSTAGRAM");
  const [format, setFormat] = useState<"square" | "portrait">("square");
  const [gradientId, setGradientId] = useState("");
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    showLogo: true, showPrice: true, showDescription: false, showCTA: true, showSupportingImages: true,
  });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ imageUrl: string } | null>(null);

  const { data: historyData, refetch: refetchHistory } = useFetch<{ creatives: any[] }>(
    productId ? `/social/history/${productId}` : null,
    [productId]
  );

  async function handleGenerate() {
    if (!productId) {
      toast.error("Please select a product");
      return;
    }
    setGenerating(true);
    try {
      const { creative } = await clientApi.post<{ creative: any }>("/social/generate", {
        productId,
        platform,
        format: platform === "INSTAGRAM" ? format : undefined,
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

  return (
    <div>
      <PageHeader title="Social Media Generator" description="Create branded Instagram and TikTok promotional creatives from any product." />

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

            <div>
              <p className="mb-1.5 text-sm font-medium text-cream">Platform</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPlatform("INSTAGRAM")}
                  className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium", platform === "INSTAGRAM" ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-600 text-cream")}
                >
                  <Instagram className="h-4 w-4" /> Instagram
                </button>
                <button
                  onClick={() => setPlatform("TIKTOK")}
                  className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium", platform === "TIKTOK" ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-600 text-cream")}
                >
                  <TikTokIcon className="h-4 w-4" /> TikTok
                </button>
              </div>
            </div>

            {platform === "INSTAGRAM" && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-cream">Format</p>
                <Select value={format} onChange={(e) => setFormat(e.target.value as any)}>
                  <option value="square">Square (1:1)</option>
                  <option value="portrait">Portrait (4:5)</option>
                </Select>
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
