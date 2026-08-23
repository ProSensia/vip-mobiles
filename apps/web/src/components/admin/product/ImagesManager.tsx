"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, Star, Trash2, Loader2, GripVertical } from "lucide-react";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { cn } from "@/lib/utils";

export interface ProductImage {
  id: string;
  url: string;
  webpUrl?: string | null;
  thumbUrl?: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export function ImagesManager({ productId, images, onChange }: { productId: string; images: ProductImage[]; onChange: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      list.forEach((f) => formData.append("images", f));
      await clientApi.upload(`/products/${productId}/images`, formData);
      toast.success(`${list.length} image(s) uploaded and optimized`);
      onChange();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function setPrimary(imageId: string) {
    await clientApi.patch(`/products/${productId}/images/${imageId}/primary`, {});
    onChange();
  }

  async function deleteImage(imageId: string) {
    await clientApi.delete(`/products/${productId}/images/${imageId}`);
    toast.success("Image removed");
    onChange();
  }

  async function reorder(newOrder: ProductImage[]) {
    await clientApi.patch(`/products/${productId}/images/reorder`, { order: newOrder.map((i) => i.id) });
    onChange();
  }

  function handleDrop(index: number) {
    if (dragIndex.current === null || dragIndex.current === index) return;
    const next = [...images];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(index, 0, moved);
    dragIndex.current = null;
    reorder(next);
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl2 border-2 border-dashed p-8 text-center transition-colors",
          dragOver ? "border-gold-500 bg-gold-500/5" : "border-ink-600 hover:border-gold-500/50"
        )}
      >
        {uploading ? <Loader2 className="h-8 w-8 animate-spin text-gold-400" /> : <Upload className="h-8 w-8 text-muted" />}
        <p className="text-sm text-cream">{uploading ? "Uploading & optimizing..." : "Drag & drop images, or click to browse"}</p>
        <p className="text-xs text-muted">JPEG, PNG or WebP — automatically converted to WebP/AVIF</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {images.map((img, i) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => (dragIndex.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(i)}
              className={cn("group relative aspect-square overflow-hidden rounded-lg border-2", img.isPrimary ? "border-gold-500" : "border-ink-600")}
            >
              <Image src={img.thumbUrl || img.webpUrl || img.url} alt="" fill className="object-cover" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink-950/0 opacity-0 transition-opacity group-hover:bg-ink-950/70 group-hover:opacity-100">
                <GripVertical className="absolute left-1 top-1 h-4 w-4 cursor-grab text-cream/70" />
                {!img.isPrimary && (
                  <button onClick={() => setPrimary(img.id)} title="Set as primary" className="rounded-full bg-ink-900 p-1.5 text-gold-400 hover:bg-ink-800">
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => deleteImage(img.id)} title="Delete" className="rounded-full bg-ink-900 p-1.5 text-red-400 hover:bg-ink-800">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {img.isPrimary && <span className="absolute bottom-1 left-1 rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold text-ink-950">Primary</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
