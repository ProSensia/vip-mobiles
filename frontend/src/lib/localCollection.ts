"use client";

import { useCallback, useEffect, useState } from "react";

// Wishlist / Recently Viewed / Compare are all "a small list of products
// this visitor cares about right now" — none of it needs to survive across
// devices or be queryable server-side, so a shared localStorage-backed
// primitive keeps all three lightweight (no schema, no API calls, no auth
// dependency) instead of standing up a real backend feature for each.

export interface MiniProduct {
  id: string;
  slug: string;
  title: string;
  basePrice: string | number;
  image?: string | null;
  brand?: string | null;
  condition?: string;
}

function readList(key: string): MiniProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as MiniProduct[]) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, items: MiniProduct[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new Event(`local-collection:${key}`));
  } catch {
    // Storage unavailable (private browsing, quota exceeded) — these
    // features are conveniences, not core functionality, so fail silently.
  }
}

export function useLocalCollection(key: string, maxItems?: number) {
  const [items, setItems] = useState<MiniProduct[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readList(key));
    setHydrated(true);
    const handler = () => setItems(readList(key));
    window.addEventListener(`local-collection:${key}`, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(`local-collection:${key}`, handler);
      window.removeEventListener("storage", handler);
    };
  }, [key]);

  const add = useCallback(
    (product: MiniProduct) => {
      const current = readList(key).filter((p) => p.id !== product.id);
      const next = [product, ...current];
      const trimmed = maxItems ? next.slice(0, maxItems) : next;
      writeList(key, trimmed);
      setItems(trimmed);
    },
    [key, maxItems]
  );

  const remove = useCallback(
    (id: string) => {
      const next = readList(key).filter((p) => p.id !== id);
      writeList(key, next);
      setItems(next);
    },
    [key]
  );

  const toggle = useCallback(
    (product: MiniProduct) => {
      const isSaved = readList(key).some((p) => p.id === product.id);
      if (isSaved) {
        remove(product.id);
        return false;
      }
      add(product);
      return true;
    },
    [key, add, remove]
  );

  const clear = useCallback(() => {
    writeList(key, []);
    setItems([]);
  }, [key]);

  const has = useCallback((id: string) => items.some((p) => p.id === id), [items]);

  return { items, hydrated, add, remove, toggle, has, clear };
}

export function useWishlist() {
  return useLocalCollection("vip_wishlist");
}

export function useRecentlyViewed() {
  return useLocalCollection("vip_recently_viewed", 12);
}

export const COMPARE_MAX = 3;

export function useCompare() {
  return useLocalCollection("vip_compare", COMPARE_MAX);
}
