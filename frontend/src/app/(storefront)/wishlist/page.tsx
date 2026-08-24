"use client";

import { Heart, Trash2 } from "lucide-react";
import { useWishlist } from "@/lib/localCollection";
import { ProductCard, type ProductCardData } from "@/components/storefront/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";

function miniToCard(p: { id: string; slug: string; title: string; basePrice: string | number; image?: string | null; brand?: string | null; condition?: string }): ProductCardData {
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

export default function WishlistPage() {
  const { items, hydrated, clear } = useWishlist();

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-cream">My Wishlist</h1>
          <p className="mt-1 text-sm text-muted">Saved on this device — {items.length} item{items.length === 1 ? "" : "s"}.</p>
        </div>
        {hydrated && items.length > 0 && (
          <button onClick={clear} className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-red-400">
            <Trash2 className="h-4 w-4" /> Clear all
          </button>
        )}
      </div>

      <div className="mt-8">
        {!hydrated ? null : items.length === 0 ? (
          <EmptyState icon={Heart} title="Your wishlist is empty" description="Tap the heart icon on any phone to save it here." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={miniToCard(p)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
