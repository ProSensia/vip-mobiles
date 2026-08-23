"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, Input } from "@/components/ui/Input";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";

export function CatalogFilters({ brands, categories }: { brands: Array<{ slug: string; name: string }>; categories: Array<{ slug: string; name: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
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
  );
}
