"use client";

import { useEffect } from "react";
import { useRecentlyViewed, type MiniProduct } from "@/lib/localCollection";
import { ProductCard, type ProductCardData } from "./ProductCard";
import { SectionHeading } from "./SectionHeading";

/** Invisible — records a product detail page view into the visitor's local history. Mount once on the product page. */
export function TrackRecentlyViewed({ product }: { product: MiniProduct }) {
  const { add } = useRecentlyViewed();
  // Deliberately omit `add` from deps: it's stable across renders for a
  // given key, and including it would re-fire on every localStorage write
  // (including this one) since the hook re-reads state after writing.
  useEffect(() => {
    add(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);
  return null;
}

/** Shown on the homepage/catalog — nothing rendered (not even the heading) if the visitor hasn't viewed anything yet. */
export function RecentlyViewedSection({ excludeId }: { excludeId?: string }) {
  const { items, hydrated } = useRecentlyViewed();
  const visible = items.filter((p) => p.id !== excludeId).slice(0, 8);

  if (!hydrated || visible.length === 0) return null;

  return (
    <section className="container-page py-10">
      <SectionHeading title="Recently Viewed" subtitle="Pick up where you left off" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((p) => (
          <ProductCard key={p.id} product={miniToCard(p)} />
        ))}
      </div>
    </section>
  );
}

function miniToCard(p: MiniProduct): ProductCardData {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    condition: p.condition ?? "USED",
    status: "AVAILABLE",
    basePrice: p.basePrice,
    boxAvailable: false,
    brand: p.brand ? { name: p.brand } : null,
    images: p.image ? [{ url: p.image, webpUrl: p.image, mediumUrl: p.image, thumbUrl: p.image }] : [],
  };
}
