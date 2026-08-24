"use client";

import Link from "next/link";
import Image from "next/image";
import { X, Scale } from "lucide-react";
import { useCompare } from "@/lib/localCollection";

/** Floating bar that appears once 1+ products are selected for comparison — mounted once in the storefront layout so it persists across navigation. */
export function CompareBar() {
  const { items, remove, clear, hydrated } = useCompare();

  if (!hydrated || items.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-600 bg-ink-900/95 backdrop-blur">
      <div className="container-page flex flex-wrap items-center gap-3 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-cream">
          <Scale className="h-4 w-4 text-gold-400" /> Compare ({items.length})
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-800 py-1 pl-1 pr-2">
              {p.image && (
                <span className="relative h-6 w-6 overflow-hidden rounded-full">
                  <Image src={p.image} alt="" fill className="object-cover" />
                </span>
              )}
              <span className="max-w-[100px] truncate text-xs text-cream">{p.title}</span>
              <button onClick={() => remove(p.id)} aria-label={`Remove ${p.title} from comparison`} className="text-muted hover:text-red-400">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clear} className="text-xs font-medium text-muted hover:text-cream">
            Clear
          </button>
          <Link
            href="/compare"
            className="rounded-lg bg-gold-500 px-4 py-2 text-xs font-semibold text-ink-950 shadow-gold hover:bg-gold-400"
          >
            Compare Now
          </Link>
        </div>
      </div>
    </div>
  );
}
