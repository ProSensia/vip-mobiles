"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Star, Trash2, Check, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { clientApi, ClientApiError } from "@/lib/clientApi";

interface Review {
  id: string;
  customerName: string;
  rating: number;
  comment?: string | null;
  photoUrl?: string | null;
  isVerified?: boolean;
  isApproved: boolean;
}

export function ReviewsManager({ productId, reviews, onChange }: { productId: string; reviews: Review[]; onChange: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function approve(id: string) {
    await clientApi.patch(`/products/${productId}/reviews/${id}/approve`, {});
    toast.success("Review approved");
    onChange();
  }

  async function remove(id: string) {
    await clientApi.delete(`/products/${productId}/reviews/${id}`);
    toast.success("Review removed");
    onChange();
  }

  async function addReview(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await clientApi.post(`/products/${productId}/reviews`, { customerName: name, rating, comment: comment || undefined });
      toast.success("Review added");
      setName("");
      setComment("");
      setShowForm(false);
      onChange();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not add review");
    } finally {
      setSaving(false);
    }
  }

  const pending = reviews.filter((r) => !r.isApproved);
  const approved = reviews.filter((r) => r.isApproved);

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-amber-400">Pending Moderation ({pending.length})</p>
          <div className="space-y-2">
            {pending.map((r) => (
              <ReviewRow key={r.id} review={r} onApprove={() => approve(r.id)} onDelete={() => remove(r.id)} />
            ))}
          </div>
        </div>
      )}

      {approved.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-cream">Published Reviews</p>
          <div className="space-y-2">
            {approved.map((r) => (
              <ReviewRow key={r.id} review={r} onDelete={() => remove(r.id)} />
            ))}
          </div>
        </div>
      )}

      {!showForm ? (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add Curated Review</Button>
      ) : (
        <form onSubmit={addReview} className="space-y-3 rounded-xl border border-ink-600 bg-ink-800/40 p-4">
          <Input placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button key={i} type="button" onClick={() => setRating(i + 1)}>
                <Star className={`h-5 w-5 ${i < rating ? "fill-gold-400 text-gold-400" : "text-ink-600"}`} />
              </button>
            ))}
          </div>
          <Textarea placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button type="submit" size="sm" loading={saving}>Save Review</Button>
        </form>
      )}
    </div>
  );
}

function ReviewRow({ review, onApprove, onDelete }: { review: Review; onApprove?: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-800/40 p-3">
      <div className="flex items-start gap-3">
        {review.photoUrl && (
          <a href={review.photoUrl} target="_blank" rel="noreferrer">
            <img src={review.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          </a>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-cream">{review.customerName}</span>
            <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? "fill-gold-400 text-gold-400" : "text-ink-600"}`} />)}</div>
            {review.isVerified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <ShieldCheck className="h-3 w-3" /> Verified Purchase
              </span>
            )}
          </div>
          {review.comment && <p className="mt-1 text-xs text-muted">{review.comment}</p>}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {onApprove && <button onClick={onApprove}><Check className="h-4 w-4 text-emerald-400" /></button>}
        <button onClick={onDelete}><Trash2 className="h-4 w-4 text-red-400" /></button>
      </div>
    </div>
  );
}
