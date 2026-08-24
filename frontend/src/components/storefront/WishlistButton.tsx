"use client";

import { Heart } from "lucide-react";
import { useWishlist, type MiniProduct } from "@/lib/localCollection";
import { cn } from "@/lib/utils";

export function WishlistButton({
  product,
  className,
  size = "md",
}: {
  product: MiniProduct;
  className?: string;
  size?: "sm" | "md";
}) {
  const { has, toggle, hydrated } = useWishlist();
  const saved = hydrated && has(product.id);

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(product);
      }}
      className={cn(
        "flex items-center justify-center rounded-full border transition-colors",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        saved
          ? "border-gold-500 bg-gold-500 text-ink-950"
          : "border-ink-600 bg-ink-950/80 text-cream hover:border-gold-500/60 hover:text-gold-400",
        className
      )}
    >
      <Heart className={cn(size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]", saved && "fill-current")} />
    </button>
  );
}
