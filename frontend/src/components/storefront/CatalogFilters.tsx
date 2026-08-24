"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useState, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function CatalogFilters({ brands, categories }: { brands: Array<{ slug: string; name: string }>; categories: Array<{ slug: string; name: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [showMore, setShowMore] = useState(Boolean(searchParams.get("minPrice") || searchParams.get("maxPrice") || searchParams.get("status")));
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function applyPriceRange(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (minPrice) params.set("minPrice", minPrice); else params.delete("minPrice");
    if (maxPrice) params.set("maxPrice", maxPrice); else params.delete("maxPrice");
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const activeCount = ["brand", "category", "condition", "status", "minPrice", "maxPrice"].filter((k) => searchParams.get(k)).length;

  return (
    <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <form
        className="col-span-2 sm:col-span-2"
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("q", q);
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search phones..." className="pl-9" />
        </div>
      </form>

      <Select defaultValue={searchParams.get("brand") ?? ""} onChange={(e) => updateParam("brand", e.target.value)}>
        <option value="">All Brands</option>
        {brands.map((b) => (
          <option key={b.slug} value={b.slug}>{b.name}</option>
        ))}
      </Select>

      <Select defaultValue={searchParams.get("category") ?? ""} onChange={(e) => updateParam("category", e.target.value)}>
        <option value="">All Categories</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>{c.name}</option>
        ))}
      </Select>

      <Select defaultValue={searchParams.get("condition") ?? ""} onChange={(e) => updateParam("condition", e.target.value)}>
        <option value="">Any Condition</option>
        <option value="NEW">New</option>
        <option value="USED">Used</option>
        <option value="REFURBISHED">Refurbished</option>
        <option value="OPEN_BOX">Open Box</option>
      </Select>

      <Select defaultValue={searchParams.get("sort") ?? "newest"} onChange={(e) => updateParam("sort", e.target.value)}>
        <option value="newest">Newest First</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="featured">Featured</option>
      </Select>
    </div>

    <div>
      <button
        type="button"
        onClick={() => setShowMore((s) => !s)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-gold-400"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {showMore ? "Hide" : "More Filters"}
        {activeCount > 0 && <span className="rounded-full bg-gold-500/15 px-1.5 text-gold-400">{activeCount}</span>}
      </button>
    </div>

    {showMore && (
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-ink-600 bg-ink-800/40 p-3">
        <form onSubmit={applyPriceRange} className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Min Price</label>
            <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" className="w-28" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Max Price</label>
            <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Any" className="w-28" />
          </div>
          <Button type="submit" size="sm" variant="secondary">Apply</Button>
        </form>

        <div>
          <label className="mb-1 block text-xs text-muted">Availability</label>
          <Select defaultValue={searchParams.get("status") ?? ""} onChange={(e) => updateParam("status", e.target.value)} className="w-40">
            <option value="">Any Availability</option>
            <option value="AVAILABLE">In Stock</option>
            <option value="RESERVED">Reserved</option>
          </Select>
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setMinPrice("");
              setMaxPrice("");
              setQ("");
              startTransition(() => router.push(pathname));
            }}
            className={cn("flex items-center gap-1 text-xs font-medium text-muted hover:text-red-400")}
          >
            <X className="h-3.5 w-3.5" /> Clear all filters
          </button>
        )}
      </div>
    )}
    </div>
  );
}
