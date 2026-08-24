"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Scale, X } from "lucide-react";
import { useCompare } from "@/lib/localCollection";
import { clientApi } from "@/lib/clientApi";
import { formatCurrency } from "@/lib/utils";
import { ConditionBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

interface CompareProduct {
  id: string;
  slug: string;
  title: string;
  condition: string;
  basePrice: string | number;
  compareAtPrice?: string | number | null;
  brand?: { name: string } | null;
  images: Array<{ thumbUrl?: string | null; webpUrl?: string | null; url: string }>;
  specifications?: Array<{ label: string; value: string }> | null;
}

// Fixed rows always shown, plus whatever spec labels the selected products
// actually have — no assumption about a specific phone spec vocabulary.
const FIXED_ROWS = ["Price", "Brand", "Condition"];

export default function ComparePage() {
  const { items, remove } = useCompare();
  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (items.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(
      items.map((i) =>
        clientApi.get<{ product: CompareProduct }>(`/products/${i.slug}`).then((r) => r.product).catch(() => null)
      )
    ).then((results) => {
      setProducts(results.filter((p): p is CompareProduct => p !== null));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(",")]);

  const specLabels = Array.from(
    new Set(products.flatMap((p) => (p.specifications ?? []).map((s) => s.label)))
  );

  function specValue(p: CompareProduct, label: string) {
    return p.specifications?.find((s) => s.label === label)?.value ?? "—";
  }

  return (
    <div className="container-page py-8">
      <h1 className="font-display text-3xl font-bold text-cream">Compare Phones</h1>
      <p className="mt-1 text-sm text-muted">Side-by-side comparison of your selected phones.</p>

      <div className="mt-8">
        {loading ? (
          <p className="text-sm text-muted">Loading comparison...</p>
        ) : products.length === 0 ? (
          <EmptyState icon={Scale} title="Nothing to compare yet" description="Tap the compare icon on any phone to add it here (up to 3)." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="w-32" />
                  {products.map((p) => (
                    <th key={p.id} className="p-3 text-left align-top">
                      <div className="relative">
                        <button
                          onClick={() => remove(p.id)}
                          aria-label={`Remove ${p.title}`}
                          className="absolute -right-1 -top-1 rounded-full bg-ink-900 p-1 text-muted hover:text-red-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="relative aspect-square w-full max-w-[160px] overflow-hidden rounded-xl border border-ink-600 bg-ink-900">
                          {p.images[0] && (
                            <Image src={p.images[0].webpUrl || p.images[0].url} alt={p.title} fill className="object-cover" />
                          )}
                        </div>
                        <Link href={`/product/${p.slug}`} className="mt-2 block line-clamp-2 font-display text-sm font-semibold text-cream hover:text-gold-400">
                          {p.title}
                        </Link>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FIXED_ROWS.map((row, i) => (
                  <tr key={row} className={i % 2 === 0 ? "bg-ink-900/50" : ""}>
                    <td className="p-3 text-sm font-medium text-muted">{row}</td>
                    {products.map((p) => (
                      <td key={p.id} className="p-3 text-sm text-cream">
                        {row === "Price" ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-gold-400">{formatCurrency(p.basePrice)}</span>
                            {p.compareAtPrice && <span className="text-xs text-muted line-through">{formatCurrency(p.compareAtPrice)}</span>}
                          </div>
                        ) : row === "Brand" ? (
                          p.brand?.name ?? "—"
                        ) : (
                          <ConditionBadge condition={p.condition} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {specLabels.map((label, i) => (
                  <tr key={label} className={(FIXED_ROWS.length + i) % 2 === 0 ? "bg-ink-900/50" : ""}>
                    <td className="p-3 text-sm font-medium text-muted">{label}</td>
                    {products.map((p) => (
                      <td key={p.id} className="p-3 text-sm text-cream/90">
                        {specValue(p, label)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
