"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";
import { clientApi, ClientApiError } from "@/lib/clientApi";

export function ImageUploader({
  folder,
  value,
  onChange,
  aspect = "aspect-video",
}: {
  folder: "banners" | "brands" | "categories" | "branches" | "staff" | "settings";
  value?: string | null;
  onChange: (url: string) => void;
  aspect?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const result = await clientApi.upload<{ url: string }>(`/media/image?folder=${folder}`, formData);
      onChange(result.url);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {value ? (
        <div className={`relative overflow-hidden rounded-xl border border-ink-600 ${aspect}`}>
          <Image src={value} alt="" fill className="object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-2 rounded-full bg-ink-950/80 p-1.5 text-cream hover:bg-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-600 text-muted hover:border-gold-500/50 hover:text-gold-400 ${aspect}`}
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
          <span className="text-xs">{uploading ? "Uploading..." : "Click to upload image"}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}
