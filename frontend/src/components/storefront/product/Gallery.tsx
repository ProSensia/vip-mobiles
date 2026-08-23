"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  id: string;
  url: string;
  webpUrl?: string | null;
  thumbUrl?: string | null;
  altText?: string | null;
}

export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  if (images.length === 0) {
    return <div className="aspect-square rounded-xl2 border border-ink-600 bg-ink-800" />;
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl2 border border-ink-600 bg-ink-900">
        <Image
          key={current.id}
          src={current.webpUrl || current.url}
          alt={current.altText || title}
          fill
          priority={active === 0}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover animate-fade-in"
        />
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-thin">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                i === active ? "border-gold-500" : "border-ink-600 opacity-70 hover:opacity-100"
              )}
            >
              <Image src={img.thumbUrl || img.webpUrl || img.url} alt="" fill loading="lazy" sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
