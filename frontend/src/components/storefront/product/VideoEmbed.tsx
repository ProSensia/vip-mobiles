"use client";

import { useState } from "react";
import Script from "next/script";
import { Play, ExternalLink } from "lucide-react";

export interface ProductVideo {
  id: string;
  platform: "YOUTUBE" | "TIKTOK" | "INSTAGRAM";
  url: string;
  embedId?: string | null;
  caption?: string | null;
}

const PLATFORM_LABEL: Record<ProductVideo["platform"], string> = {
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
};

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
    tiktokEmbed?: { lib: { render: (el?: HTMLElement) => void } };
  }
}

export function VideoEmbedGrid({ videos }: { videos: ProductVideo[] }) {
  if (videos.length === 0) return null;

  return (
    // Two columns, not three — Instagram/TikTok's official embeds need real
    // width (Instagram enforces a ~326px minimum) or they render clipped
    // inside a narrower grid cell, which is what caused the left-edge
    // cropping.
    <div className="grid gap-6 sm:grid-cols-2">
      {videos.map((v) => <VideoEmbedCard key={v.id} video={v} />)}
    </div>
  );
}

function VideoEmbedCard({ video }: { video: ProductVideo }) {
  return (
    <div className="overflow-hidden rounded-xl2 border border-ink-600 bg-ink-800/60">
      {video.platform === "YOUTUBE" && video.embedId && (
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${video.embedId}`}
            title={video.caption || "Product video review"}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      )}

      {video.platform === "YOUTUBE" && !video.embedId && <UnsupportedEmbed video={video} />}
      {video.platform === "TIKTOK" && <ClickToLoadEmbed video={video} />}
      {video.platform === "INSTAGRAM" && <ClickToLoadEmbed video={video} />}

      {video.caption && <p className="border-t border-ink-600 px-3 py-2 text-xs text-muted">{video.caption}</p>}
    </div>
  );
}

/**
 * Instagram/TikTok's embed scripts process every matching blockquote on the
 * page as soon as they load — with several reviews on a product page,
 * that's several heavy third-party iframes loading whether or not anyone
 * scrolls to them. Only render the actual blockquote (and trigger the
 * platform script) once the visitor asks for it; until then, show a
 * lightweight placeholder with a direct link as a fallback if the embed
 * script is blocked or slow (ad blockers commonly block these).
 */
function ClickToLoadEmbed({ video }: { video: ProductVideo }) {
  const [loaded, setLoaded] = useState(false);

  function handleLoadScript() {
    // The script may already be loaded from a previous card on this page —
    // in that case Script's onLoad never fires again, so re-trigger
    // processing manually for this newly-added blockquote.
    if (video.platform === "INSTAGRAM" && window.instgrm) window.instgrm.Embeds.process();
    if (video.platform === "TIKTOK" && window.tiktokEmbed) window.tiktokEmbed.lib.render();
  }

  if (!loaded) {
    return (
      <button
        onClick={() => setLoaded(true)}
        className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 bg-ink-900 text-cream transition-colors hover:bg-ink-800"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/15 text-gold-400">
          <Play className="h-6 w-6" />
        </span>
        <span className="text-sm font-medium">View {PLATFORM_LABEL[video.platform]} Post</span>
      </button>
    );
  }

  return (
    <div className="relative mx-auto flex justify-center bg-ink-900 p-2" style={{ minWidth: 326 }}>
      {video.platform === "INSTAGRAM" && (
        <>
          <blockquote className="instagram-media" data-instgrm-permalink={video.url} data-instgrm-version="14" style={{ margin: 0, width: "100%", minWidth: 326 }} />
          <Script src="https://www.instagram.com/embed.js" strategy="lazyOnload" onLoad={handleLoadScript} onReady={handleLoadScript} />
        </>
      )}
      {video.platform === "TIKTOK" && (
        <>
          <blockquote className="tiktok-embed" cite={video.url} data-video-id={video.embedId ?? undefined} style={{ margin: 0, width: "100%", minWidth: 326 }}>
            <section />
          </blockquote>
          <Script src="https://www.tiktok.com/embed.js" strategy="lazyOnload" onLoad={handleLoadScript} onReady={handleLoadScript} />
        </>
      )}
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-ink-950/80 px-2.5 py-1 text-[10px] font-medium text-cream hover:text-gold-400"
      >
        <ExternalLink className="h-3 w-3" /> Open on {PLATFORM_LABEL[video.platform]}
      </a>
    </div>
  );
}

function UnsupportedEmbed({ video }: { video: ProductVideo }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-ink-900 text-cream hover:bg-ink-800"
    >
      <ExternalLink className="h-6 w-6 text-gold-400" />
      <span className="text-sm font-medium">Watch on {PLATFORM_LABEL[video.platform]}</span>
    </a>
  );
}
