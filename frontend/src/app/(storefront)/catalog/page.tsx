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

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;

  if (sp.category) {
    const data = await publicApiSafe<{ category: any }>(`/api/categories/${sp.category}`);
    if (data?.category) {
      const { category } = data;
      return {
        title: category.metaTitle || `${category.name} — Shop ${category.name}`,
        description: category.metaDescription || category.description || `Browse our ${category.name.toLowerCase()} collection.`,
        alternates: { canonical: `${SITE_URL}/catalog?category=${category.slug}` },
      };
    }
  }

  if (sp.brand) {
    const data = await publicApiSafe<{ brand: any }>(`/api/brands/${sp.brand}`);
    if (data?.brand) {
      const { brand } = data;
      return {
        title: brand.metaTitle || `${brand.name} Phones`,
        description: brand.metaDescription || brand.description || `Shop genuine ${brand.name} smartphones.`,
        alternates: { canonical: `${SITE_URL}/catalog?brand=${brand.slug}` },
      };
    }
  }

  return {
    title: "Shop All Phones",
    description: "Browse our full catalog of new, used and refurbished smartphones with genuine warranty.",
    alternates: { canonical: `${SITE_URL}/catalog` },
  };
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["category", "brand", "condition", "status", "q", "sort", "page", "minPrice", "maxPrice"]) {
    if (sp[key]) params.set(key, sp[key]!);
  }
  params.set("limit", "24");

  const [productsData, brandsData, categoriesData] = await Promise.all([
    publicApiSafe<CatalogResponse>(`/api/products?${params.toString()}`),
    publicApiSafe<{ brands: any[] }>("/api/brands"),
    publicApiSafe<{ categories: any[] }>("/api/categories"),
  ]);

  const items = productsData?.items ?? [];
  const page = productsData?.page ?? 1;
  const totalPages = productsData?.totalPages ?? 1;

  function buildHref(p: number) {
    const next = new URLSearchParams(params);
    next.delete("limit");
    next.set("page", String(p));
    return `/catalog?${next.toString()}`;
  }

  return (
    <div className="container-page py-8">
      <h1 className="font-display text-3xl font-bold text-cream">Shop All Phones</h1>
      <p className="mt-1 text-sm text-muted">{productsData?.total ?? 0} products available</p>

      <div className="mt-6">
        <CatalogFilters brands={brandsData?.brands ?? []} categories={categoriesData?.categories ?? []} />
      </div>

      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState icon={SearchX} title="No products match your filters" description="Try adjusting your search or clearing filters." />
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
