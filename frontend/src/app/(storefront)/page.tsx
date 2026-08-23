import { publicApiSafe } from "@/lib/api";
import { HeroBanner } from "@/components/storefront/HeroBanner";
import { SectionHeading } from "@/components/storefront/SectionHeading";
import { ProductCard, type ProductCardData } from "@/components/storefront/ProductCard";
import { CategoryCard } from "@/components/storefront/CategoryCard";
import { BranchCard } from "@/components/storefront/BranchCard";
import Link from "next/link";

export const revalidate = 60;

interface HomepageSection {
  id: string;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  config: any;
}

async function getData() {
  const [sectionsData, bannersData] = await Promise.all([
    publicApiSafe<{ sections: HomepageSection[] }>("/api/homepage-sections"),
    publicApiSafe<{ banners: any[] }>("/api/banners?placement=HOME_HERO"),
  ]);
  return { sections: sectionsData?.sections ?? [], heroBanner: bannersData?.banners?.[0] ?? null };
}

async function renderSection(section: HomepageSection) {
  switch (section.type) {
    case "FEATURED_PRODUCTS": {
      const limit = section.config?.limit ?? 9;
      const data = await publicApiSafe<{ items: ProductCardData[] }>(`/api/products/featured?limit=${limit}`);
      if (!data?.items?.length) return null;
      return (
        <section key={section.id} className="container-page py-10">
          <SectionHeading title={section.title || "Featured Phones"} subtitle={section.subtitle} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          <div className="mt-6 text-center">
            <Link href="/catalog" className="text-sm font-semibold text-gold-400 hover:underline">
              View Full Catalog →
            </Link>
          </div>
        </section>
      );
    }
    case "NEW_ARRIVALS": {
      const limit = section.config?.limit ?? 8;
      const data = await publicApiSafe<{ items: ProductCardData[] }>(`/api/products/new-arrivals?limit=${limit}`);
      if (!data?.items?.length) return null;
      return (
        <section key={section.id} className="container-page py-10">
          <SectionHeading title={section.title || "New Arrivals"} subtitle={section.subtitle} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      );
    }
    case "FEATURED_CATEGORIES": {
      const data = await publicApiSafe<{ categories: any[] }>("/api/categories?featured=1");
      if (!data?.categories?.length) return null;
      return (
        <section key={section.id} className="container-page py-10">
          <SectionHeading title={section.title || "Shop by Category"} subtitle={section.subtitle} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {data.categories.map((c) => <CategoryCard key={c.id} category={c} />)}
          </div>
        </section>
      );
    }
    case "BRANCHES": {
      const data = await publicApiSafe<{ branches: any[] }>("/api/branches");
      if (!data?.branches?.length) return null;
      return (
        <section key={section.id} className="container-page py-10">
          <SectionHeading title={section.title || "Visit Our Branches"} subtitle={section.subtitle} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.branches.map((b) => <BranchCard key={b.id} branch={b} />)}
          </div>
        </section>
      );
    }
    case "CUSTOM_HTML": {
      // Rendered as plain text (never raw HTML) to avoid stored-XSS from admin-entered content.
      const body = section.config?.body;
      if (!body) return null;
      return (
        <section key={section.id} className="container-page py-10">
          <SectionHeading title={section.title || ""} subtitle={section.subtitle} />
          <p className="whitespace-pre-line text-cream/80">{body}</p>
        </section>
      );
    }
    default:
      return null;
  }
}

export default async function HomePage() {
  const { sections, heroBanner } = await getData();

  return (
    <>
      {heroBanner && <HeroBanner banner={heroBanner} />}
      {await Promise.all(sections.map(renderSection))}
    </>
  );
}
