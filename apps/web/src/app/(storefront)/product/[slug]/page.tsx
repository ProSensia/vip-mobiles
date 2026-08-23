import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicApiSafe } from "@/lib/api";
import { ProductInteractive } from "@/components/storefront/product/ProductInteractive";
import { SpecTable } from "@/components/storefront/product/SpecTable";
import { VideoEmbedGrid } from "@/components/storefront/product/VideoEmbed";
import { ReviewsSection } from "@/components/storefront/product/ReviewsSection";
import { ProductCard, type ProductCardData } from "@/components/storefront/ProductCard";
import { SectionHeading } from "@/components/storefront/SectionHeading";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface ProductDetail {
  id: string;
  title: string;
  slug: string;
  condition: string;
  status: string;
  description?: string | null;
  specifications?: Array<{ label: string; value: string }> | null;
  basePrice: string | number;
  compareAtPrice?: string | number | null;
  boxAvailable: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  brand: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  branch?: { id: string; name: string; slug: string } | null;
  variants: Array<any>;
  images: Array<any>;
  videos: Array<any>;
  reviews: Array<any>;
}

async function getProduct(slug: string) {
  return publicApiSafe<{ product: ProductDetail; related: ProductCardData[] }>(`/api/products/${slug}`);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) return {};
  const { product } = data;
  const title = product.metaTitle || `${product.title} – ${product.condition.toLowerCase()} | VIP Mobiles`;
  const description = product.metaDescription || product.description?.slice(0, 160) || `${product.title} available at VIP Mobiles.`;
  const image = product.images?.[0]?.webpUrl || product.images?.[0]?.url;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/product/${product.slug}` },
    openGraph: { title, description, images: image ? [{ url: image }] : undefined, type: "website" },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) notFound();
  const { product, related } = data;

  const settings = await publicApiSafe<{ settings: any }>("/api/settings");
  const whatsappNumber = settings?.settings?.whatsappNumber || "";
  const currency = settings?.settings?.currency || "PKR";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    image: product.images?.map((i: any) => i.webpUrl || i.url),
    brand: { "@type": "Brand", name: product.brand.name },
    offers: {
      "@type": "Offer",
      priceCurrency: currency,
      price: product.basePrice,
      availability:
        product.status === "SOLD"
          ? "https://schema.org/SoldOut"
          : product.status === "RESERVED"
          ? "https://schema.org/LimitedAvailability"
          : "https://schema.org/InStock",
      url: `${SITE_URL}/product/${product.slug}`,
    },
    ...(product.reviews.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: (product.reviews.reduce((s: number, r: any) => s + r.rating, 0) / product.reviews.length).toFixed(1),
            reviewCount: product.reviews.length,
          },
        }
      : {}),
  };

  return (
    <div className="container-page py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 text-sm text-muted">
        <a href="/catalog" className="hover:text-cream">Catalog</a> / <span className="text-cream">{product.brand.name}</span>
      </nav>

      <ProductInteractive
        product={product}
        images={product.images}
        variants={product.variants}
        whatsappNumber={whatsappNumber}
        currency={currency}
        siteUrl={SITE_URL}
      />

      <div className="mt-14 grid gap-10 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          {product.description && (
            <div>
              <h2 className="mb-3 font-display text-xl font-bold text-cream">Description</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{product.description}</p>
            </div>
          )}

          {product.specifications && product.specifications.length > 0 && (
            <div>
              <h2 className="mb-3 font-display text-xl font-bold text-cream">Specifications</h2>
              <SpecTable specs={product.specifications} />
            </div>
          )}

          {product.videos.length > 0 && (
            <div>
              <h2 className="mb-3 font-display text-xl font-bold text-cream">Video Reviews</h2>
              <VideoEmbedGrid videos={product.videos} />
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-display text-xl font-bold text-cream">Reviews</h2>
          <ReviewsSection reviews={product.reviews} productId={product.id} />
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-16">
          <SectionHeading title="Related Products" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}
