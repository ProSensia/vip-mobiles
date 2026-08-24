"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Star, Camera, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, FormField } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { clientApi, ClientApiError } from "@/lib/clientApi";

interface TokenInfo {
  product: {
    id: string;
    title: string;
    slug: string;
    images: Array<{ thumbUrl?: string | null; url: string }>;
  };
  alreadySubmitted: boolean;
}

export default function ReviewByTokenPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    clientApi
      .get<TokenInfo>(`/reviews/token/${token}`)
      .then(setInfo)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("customerName", name);
      formData.append("rating", String(rating));
      if (comment) formData.append("comment", comment);
      if (photo) formData.append("photo", photo);
      await clientApi.upload(`/reviews/token/${token}`, formData);
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/brand/logo.jpg" alt="VIP Mobiles" width={56} height={56} className="rounded-full" />
          <h1 className="mt-3 font-display text-lg font-bold text-cream">Rate Your Purchase</h1>
        </div>

        <Card>
          <CardBody>
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : loadError || !info ? (
              <p className="text-sm text-red-400">This review link is invalid or has expired.</p>
            ) : info.alreadySubmitted || submitted ? (
              <div className="space-y-2 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" />
                <p className="text-sm text-emerald-400">
                  {submitted ? "Thanks! Your review will appear after moderation." : "You've already reviewed this purchase — thank you!"}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-800/40 p-3">
                  {info.product.images[0] && (
                    <img
                      src={info.product.images[0].thumbUrl || info.product.images[0].url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <p className="text-sm font-medium text-cream">{info.product.title}</p>
                </div>

                <FormField label="Your Name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
                </FormField>

                <div>
                  <p className="mb-1.5 text-sm font-medium text-cream">Rating</p>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button key={i} type="button" onClick={() => setRating(i + 1)}>
                        <Star className={`h-7 w-7 ${i < rating ? "fill-gold-400 text-gold-400" : "text-ink-600"}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <FormField label="Comment (optional)">
                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
                </FormField>

                <FormField label="Add a Photo (optional)">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-muted hover:text-gold-400 hover:border-gold-500/40">
                    <Camera className="h-4 w-4" />
                    {photo ? photo.name : "Choose photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
                  </label>
                </FormField>

                <Button type="submit" className="w-full" loading={submitting}>Submit Review</Button>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
