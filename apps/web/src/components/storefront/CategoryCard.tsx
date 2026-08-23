import Link from "next/link";
import Image from "next/image";
import { Smartphone } from "lucide-react";

export function CategoryCard({ category }: { category: { name: string; slug: string; imageUrl?: string | null; _count?: { products: number } } }) {
  return (
    <Link
      href={`/catalog?category=${category.slug}`}
      className="group flex flex-col items-center gap-3 rounded-xl2 border border-ink-600 bg-ink-800/60 p-5 text-center transition-colors hover:border-gold-500/50"
    >
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-ink-900">
        {category.imageUrl ? (
          <Image src={category.imageUrl} alt={category.name} width={64} height={64} className="h-full w-full object-cover" />
        ) : (
          <Smartphone className="h-7 w-7 text-gold-400" />
        )}
      </div>
      <div>
        <p className="font-display text-sm font-semibold text-cream">{category.name}</p>
        {category._count && <p className="text-xs text-muted">{category._count.products} items</p>}
      </div>
    </Link>
  );
}
