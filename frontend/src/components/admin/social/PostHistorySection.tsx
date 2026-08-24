"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Download, RefreshCw, Trash2, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { clientApi, ClientApiError } from "@/lib/clientApi";

interface HistoryItem {
  id: string;
  imageUrl: string;
  thumbUrl?: string | null;
  platform: string;
  config: { template?: string; format?: string } | null;
  createdAt: string;
  product: { id: string; title: string; slug: string };
  createdBy: { id: string; name: string } | null;
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

const FORMAT_LABEL: Record<string, string> = {
  square: "Square",
  portrait: "Portrait",
  story: "Story / Status",
};

export function PostHistorySection({ onSelectResult }: { onSelectResult: (creative: { imageUrl: string }) => void }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  async function load(p: number) {
    setLoading(true);
    try {
      const data = await clientApi.get<{ items: HistoryItem[]; totalPages: number }>(`/social/creatives?page=${p}&limit=12`);
      setItems(data.items);
      setTotalPages(data.totalPages);
    } catch {
      toast.error("Could not load post history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function regenerate(id: string) {
    setRegeneratingId(id);
    try {
      const { creative } = await clientApi.post<{ creative: HistoryItem }>(`/social/creatives/${id}/regenerate`, {});
      toast.success("New version generated");
      onSelectResult(creative);
      setPage(1);
      load(1);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not regenerate this post");
    } finally {
      setRegeneratingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await clientApi.delete(`/social/creatives/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Post deleted");
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not delete this post");
    }
  }

  return (
    <Card>
      <CardHeader title="Post History" subtitle="Every post generated across all products." />
      <CardBody>
        {loading ? (
          <p className="text-center text-sm text-muted">Loading...</p>
        ) : items.length === 0 ? (
          <EmptyState icon={ImageOff} title="No posts generated yet" description="Generated posts will appear here." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <div key={item.id} className="group relative overflow-hidden rounded-xl border border-ink-600 bg-ink-800/60">
                  <button onClick={() => onSelectResult(item)} className="relative block aspect-square w-full">
                    {item.thumbUrl ? (
                      <Image src={item.thumbUrl} alt="" fill loading="lazy" sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted"><ImageOff className="h-6 w-6" /></div>
                    )}
                  </button>
                  <div className="p-2.5">
                    <Link href={`/admin/products/${item.product.id}`} className="line-clamp-1 text-xs font-medium text-cream hover:text-gold-400">
                      {item.product.title}
                    </Link>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {item.config?.template ? item.config.template.charAt(0).toUpperCase() + item.config.template.slice(1) : "Classic"}
                      {" · "}
                      {FORMAT_LABEL[item.config?.format ?? "square"] ?? "Square"}
                    </p>
                    <p className="text-[10px] text-muted">{formatDateTime(item.createdAt)}{item.createdBy ? ` · ${item.createdBy.name}` : ""}</p>
                  </div>

                  <div className="absolute right-2 top-2 flex flex-col gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <a href={item.imageUrl} download target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-600 bg-ink-950/90 text-cream hover:text-gold-400" title="Download">
                      <Download className="h-4 w-4" />
                    </a>
                    <button onClick={() => regenerate(item.id)} disabled={regeneratingId === item.id} className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-600 bg-ink-950/90 text-cream hover:text-gold-400 disabled:opacity-50" title="Regenerate">
                      <RefreshCw className={`h-4 w-4 ${regeneratingId === item.id ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={() => setPendingDeleteId(item.id)} className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-600 bg-ink-950/90 text-cream hover:border-red-500/60 hover:text-red-400" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardBody>

      <Modal open={pendingDeleteId !== null} onClose={() => setPendingDeleteId(null)} title="Delete Generated Post">
        <p className="text-sm text-cream/90">Are you sure you want to delete this generated post? This can&apos;t be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPendingDeleteId(null)}>Cancel</Button>
          <Button variant="destructive" onClick={confirmDelete}>
            <Trash2 className="h-4 w-4" /> Delete Post
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
