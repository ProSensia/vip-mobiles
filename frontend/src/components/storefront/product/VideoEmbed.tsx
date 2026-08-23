import Script from "next/script";

export interface ProductVideo {
  id: string;
  platform: "YOUTUBE" | "TIKTOK" | "INSTAGRAM";
  url: string;
  embedId?: string | null;
  caption?: string | null;
}

export function VideoEmbedGrid({ videos }: { videos: ProductVideo[] }) {
  if (videos.length === 0) return null;
  const hasTikTok = videos.some((v) => v.platform === "TIKTOK");
  const hasInstagram = videos.some((v) => v.platform === "INSTAGRAM");

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => <VideoEmbed key={v.id} video={v} />)}
      </div>
      {hasTikTok && <Script src="https://www.tiktok.com/embed.js" strategy="lazyOnload" />}
      {hasInstagram && <Script src="https://www.instagram.com/embed.js" strategy="lazyOnload" />}
    </div>
  );
}

function VideoEmbed({ video }: { video: ProductVideo }) {
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

      {video.platform === "TIKTOK" && (
        <blockquote className="tiktok-embed" cite={video.url} data-video-id={video.embedId ?? undefined} style={{ margin: 0 }}>
          <section />
        </blockquote>
      )}

      {video.platform === "INSTAGRAM" && (
        <blockquote className="instagram-media" data-instgrm-permalink={video.url} style={{ margin: 0 }} />
      )}

      {video.caption && <p className="border-t border-ink-600 px-3 py-2 text-xs text-muted">{video.caption}</p>}
    </div>
  );
}
