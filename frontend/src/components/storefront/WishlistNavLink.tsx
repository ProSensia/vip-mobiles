"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useWishlist } from "@/lib/localCollection";

export function WishlistNavLink() {
  const { items, hydrated } = useWishlist();
  const count = hydrated ? items.length : 0;

  return (
    <Link href="/wishlist" aria-label="Wishlist" className="relative flex h-9 w-9 items-center justify-center rounded-full text-cream/80 hover:text-gold-400">
      <Heart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-ink-950">
          {count}
        </span>
      )}
    </Link>
  );
}
