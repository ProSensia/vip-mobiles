"use client";

import { Scale } from "lucide-react";
import { toast } from "sonner";
import { useCompare, COMPARE_MAX, type MiniProduct } from "@/lib/localCollection";
import { cn } from "@/lib/utils";

export function CompareCheckbox({ product, className }: { product: MiniProduct; className?: string }) {
  const { items, has, toggle, hydrated } = useCompare();
  const checked = hydrated && has(product.id);

  return (
    <button
      type="button"
      aria-label={checked ? "Remove from comparison" : "Add to comparison"}
      aria-pressed={checked}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!checked && items.length >= COMPARE_MAX) {
          toast.error(`You can compare up to ${COMPARE_MAX} phones at a time`);
          return;
        }
        toggle(product);
      }}
      className={cn(
        "flex items-center justify-center rounded-full border transition-colors",
        "h-9 w-9",
        checked
          ? "border-gold-500 bg-gold-500 text-ink-950"
          : "border-ink-600 bg-ink-950/80 text-cream hover:border-gold-500/60 hover:text-gold-400",
        className
      )}
    >
      <Scale className="h-[18px] w-[18px]" />
    </button>
  );
}
