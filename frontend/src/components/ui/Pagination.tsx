import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ page, totalPages, buildHref }: { page: number; totalPages: number; buildHref: (page: number) => string }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );

  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn("flex h-9 w-9 items-center justify-center rounded-lg border border-ink-600 text-cream hover:bg-ink-800", page === 1 && "pointer-events-none opacity-40")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      {pages.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-muted">…</span>}
          <Link
            href={buildHref(p)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium",
              p === page ? "bg-gold-500 text-ink-950" : "border border-ink-600 text-cream hover:bg-ink-800"
            )}
          >
            {p}
          </Link>
        </span>
      ))}

      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={cn("flex h-9 w-9 items-center justify-center rounded-lg border border-ink-600 text-cream hover:bg-ink-800", page === totalPages && "pointer-events-none opacity-40")}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </nav>
  );
}
