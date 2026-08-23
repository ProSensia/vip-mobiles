import Link from "next/link";
import Image from "next/image";
import { formatCurrency } from "@/lib/utils";
import { ConditionBadge } from "@/components/ui/Badge";

export interface ProductCardData {
  id: string;
  title: string;
  slug: string;
  condition: string;
  status: string;
  basePrice: string | number;
  compareAtPrice?: string | number | null;
  boxAvailable: boolean;
  brand?: { name: string } | null;
  category?: { name: string } | null;
  images: Array<{ webpUrl?: string | null; url: string; thumbUrl?: string | null }>;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const image = product.images?.[0];
  const isSold = product.status === "SOLD";
  const isReserved = product.status === "RESERVED";

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block overflow-hidden rounded-xl2 border border-ink-600 bg-ink-800/60 transition-all hover:-translate-y-0.5 hover:border-gold-500/50 hover:shadow-gold"
    >
      <div className="relative aspect-square overflow-hidden bg-ink-900">
        {image ? (
          <Image
            src={image.webpUrl || image.url}
            alt={product.title}
            fill
            loading="lazy"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">No image</div>
        )}

        {(isSold || isReserved) && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/70">
            <span className={`rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wider ${isSold ? "bg-red-600 text-white" : "bg-amber-500 text-ink-950"}`}>
              {isSold ? "Sold" : "Reserved"}
            </span>
          </div>
        )}

        {product.boxAvailable && !isSold && (
          <span className="absolute left-2 top-2 rounded-full bg-ink-950/80 px-2 py-0.5 text-[11px] font-medium text-gold-400 border border-gold-500/30">
            Box Included
          </span>
        )}
      </div>

      <div className="p-3.5">
        {product.brand && <p className="text-xs font-medium uppercase tracking-wide text-muted">{product.brand.name}</p>}
        <h3 className="mt-0.5 line-clamp-2 font-display text-sm font-semibold text-cream">{product.title}</h3>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-base font-bold text-gold-400">{formatCurrency(product.basePrice)}</span>
            {product.compareAtPrice && (
              <span className="text-xs text-muted line-through">{formatCurrency(product.compareAtPrice)}</span>
            )}
          </div>
          <ConditionBadge condition={product.condition} />
        </div>
      </div>
    </Link>
  );
}
