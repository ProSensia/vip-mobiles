import { cn } from "@/lib/utils";
import { computeStockLevel, computeDiscountPercent, type BadgeableProduct, type StockLevel } from "@/shared";

export type { BadgeableProduct, StockLevel };

const STOCK_LABEL: Record<StockLevel, string> = {
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
  RESERVED: "Reserved",
};

const STOCK_CLASS: Record<StockLevel, string> = {
  IN_STOCK: "bg-green-500/15 text-green-400 border-green-500/30",
  LOW_STOCK: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  OUT_OF_STOCK: "bg-red-500/15 text-red-400 border-red-500/30",
  RESERVED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm", className)}>
      {children}
    </span>
  );
}

export function StockBadge({ product, className }: { product: BadgeableProduct; className?: string }) {
  const level = computeStockLevel(product);
  return <Pill className={cn(STOCK_CLASS[level], className)}>{STOCK_LABEL[level]}</Pill>;
}

/**
 * The full merchandising badge stack for a product card/gallery — discount,
 * new arrival, hot deal (trending), limited stock, PTA approved. Renders
 * nothing extra when a flag doesn't apply, so it's safe to drop onto every
 * card unconditionally.
 */
export function ProductBadgeStack({ product, className }: { product: BadgeableProduct; className?: string }) {
  const discount = computeDiscountPercent(product);
  const stock = computeStockLevel(product);

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {discount !== null && discount > 0 && (
        <Pill className="border-red-500/30 bg-red-600 text-white">-{discount}%</Pill>
      )}
      {product.isNewArrival && <Pill className="border-blue-500/30 bg-blue-500/15 text-blue-400">New Arrival</Pill>}
      {product.isTrending && <Pill className="border-gold-500/30 bg-gold-500/15 text-gold-400">🔥 Hot Deal</Pill>}
      {product.isBestSeller && <Pill className="border-gold-500/30 bg-gold-500 text-ink-950">Best Seller</Pill>}
      {stock === "LOW_STOCK" && <Pill className={STOCK_CLASS.LOW_STOCK}>Limited Stock</Pill>}
      {product.isPtaApproved && <Pill className="border-cream/30 bg-ink-950/80 text-cream">PTA Approved</Pill>}
    </div>
  );
}
