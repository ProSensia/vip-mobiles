"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Eye, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ConditionBadge } from "@/components/ui/Badge";
import { ProductBadgeStack, type BadgeableProduct } from "./ProductBadges";
import { WishlistButton } from "./WishlistButton";
import type { ProductCardData } from "./ProductCard";

/**
 * Preview button + modal for a catalog/grid card. Deliberately reuses the
 * card's already-fetched summary data instead of firing a new API request —
 * "quick" means no network round trip, not just no full page navigation.
 */
export function QuickPreviewButton({ product, className }: { product: ProductCardData; className?: string }) {
  const [open, setOpen] = useState(false);
  const image = product.images?.[0];
  const badgeable: BadgeableProduct = product as unknown as BadgeableProduct;

  return (
    <>
      <button
        type="button"
        aria-label="Quick preview"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={className}
      >
        <Eye className="h-[18px] w-[18px]" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 shadow-card"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setOpen(false)}
                aria-label="Close preview"
                className="absolute right-3 top-3 z-10 rounded-full bg-ink-950/80 p-1.5 text-cream hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative aspect-square bg-ink-950">
                {image ? (
                  <Image src={image.mediumUrl || image.webpUrl || image.url} alt={product.title} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted">No image</div>
                )}
                <ProductBadgeStack product={badgeable} className="absolute left-3 top-3" />
              </div>

              <div className="space-y-3 p-5">
                {product.brand && <p className="text-xs font-medium uppercase tracking-wide text-muted">{product.brand.name}</p>}
                <h3 className="font-display text-lg font-bold text-cream">{product.title}</h3>
                <div className="flex items-center gap-2">
                  <span className="font-display text-xl font-bold text-gold-400">{formatCurrency(product.basePrice)}</span>
                  {product.compareAtPrice && (
                    <span className="text-sm text-muted line-through">{formatCurrency(product.compareAtPrice)}</span>
                  )}
                  <ConditionBadge condition={product.condition} />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Link
                    href={`/product/${product.slug}`}
                    className="flex-1 rounded-xl bg-gold-500 px-4 py-2.5 text-center text-sm font-semibold text-ink-950 shadow-gold hover:bg-gold-400"
                  >
                    View Full Details
                  </Link>
                  <WishlistButton
                    product={{ id: product.id, slug: product.slug, title: product.title, basePrice: product.basePrice, image: image?.thumbUrl || image?.url }}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
