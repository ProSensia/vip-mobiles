"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Youtube } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { clientApi, ClientApiError } from "@/lib/clientApi";

interface Video {
  id: string;
  platform: string;
  url: string;
  caption?: string | null;
}

export function VideosManager({ productId, videos, onChange }: { productId: string; videos: Video[]; onChange: () => void }) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);

  async function addVideo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await clientApi.post(`/products/${productId}/videos`, { url, caption: caption || undefined });
      toast.success("Video added");
      setUrl("");
      setCaption("");
      onChange();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not add video — check the URL is a supported YouTube, TikTok or Instagram link");
    } finally {
      setSaving(false);
    }
  }

  async function removeVideo(id: string) {
    await clientApi.delete(`/products/${productId}/videos/${id}`);
    toast.success("Video removed");
    onChange();
  }

  return (
    <div className="space-y-4">
      {videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-800/40 p-3">
              <div className="flex items-center gap-2 text-sm text-cream">
                <Youtube className="h-4 w-4 text-gold-400" />
                <span className="rounded bg-ink-700 px-1.5 py-0.5 text-xs">{v.platform}</span>
                <a href={v.url} target="_blank" rel="noopener noreferrer" className="max-w-xs truncate text-gold-400 hover:underline">{v.url}</a>
              </div>
              <button onClick={() => removeVideo(v.id)}><Trash2 className="h-4 w-4 text-red-400" /></button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addVideo} className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="YouTube, TikTok or Instagram URL" value={url} onChange={(e) => setUrl(e.target.value)} required className="flex-1" />
        <Input placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} className="sm:w-48" />
        <Button type="submit" loading={saving}><Plus className="h-4 w-4" /> Add</Button>
      </form>
    </div>
  );
}
