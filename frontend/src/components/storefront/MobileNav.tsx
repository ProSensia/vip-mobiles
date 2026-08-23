"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NAV_LINKS as LINKS } from "./navLinks";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-cream hover:bg-ink-800">
        <Menu className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink-950/98 p-6">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold text-gold-400">Menu</span>
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-cream hover:bg-ink-800">
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="mt-10 flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 font-display text-xl font-semibold text-cream hover:bg-ink-800"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
