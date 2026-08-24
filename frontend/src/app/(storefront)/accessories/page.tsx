import type { Metadata } from "next";
import { publicApiSafe } from "@/lib/api";
import { ProductCard, type ProductCardData } from "@/components/storefront/ProductCard";
import { CatalogFilters } from "@/components/storefront/CatalogFilters";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchX } from "lucide-react";

interface CatalogResponse {
  items: ProductCardData[];
  total: number;
  page: number;
  totalPages: number;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "Shop Accessories",
  description: "Cases, chargers, earphones and other genuine mobile accessories.",
  alternates: { canonical: `${SITE_URL}/accessories` },
};

// Same catalog UI as /catalog — the difference is entirely server-side
// (accessory=1 restricts to categories marked isAccessory), so accessories
// added in Admin show up here automatically with no separate rendering path
// to maintain.
export default async function AccessoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["category", "brand", "condition", "status", "q", "sort", "page", "minPrice", "maxPrice"]) {
    if (sp[key]) params.set(key, sp[key]!);
  }
  if (!sp.category) params.set("accessory", "1");
  params.set("limit", "24");

  const [productsData, brandsData, categoriesData] = await Promise.all([
    publicApiSafe<CatalogResponse>(`/api/products?${params.toString()}`),
    publicApiSafe<{ brands: any[] }>("/api/brands"),
    publicApiSafe<{ categories: any[] }>("/api/categories?accessory=1"),
  ]);

  const items = productsData?.items ?? [];
  const page = productsData?.page ?? 1;
  const totalPages = productsData?.totalPages ?? 1;

  function buildHref(p: number) {
    const next = new URLSearchParams(params);
    next.delete("limit");
    next.set("page", String(p));
    return `/accessories?${next.toString()}`;
  }

  return (
    <div className="container-page py-8">
      <h1 className="font-display text-3xl font-bold text-cream">Accessories</h1>
      <p className="mt-1 text-sm text-muted">{productsData?.total ?? 0} accessories available</p>

      <div className="mt-6">
        <CatalogFilters brands={brandsData?.brands ?? []} categories={categoriesData?.categories ?? []} />
      </div>

      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState icon={SearchX} title="No accessories match your filters" description="Try adjusting your search or clearing filters." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
