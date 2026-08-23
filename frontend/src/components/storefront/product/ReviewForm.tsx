"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, FormField } from "@/components/ui/Input";

export function ReviewForm({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: name, rating, comment: comment || undefined }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
      toast.success("Thanks! Your review will appear after moderation.");
    } catch {
      toast.error("Could not submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <p className="text-sm text-emerald-400">Thanks for your review! It will appear once approved.</p>;
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Write a Review
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 rounded-xl2 border border-ink-600 bg-ink-800/40 p-5">
      <FormField label="Your Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </FormField>
      <div>
        <p className="mb-1.5 text-sm font-medium text-cream">Rating</p>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <button key={i} type="button" onClick={() => setRating(i + 1)}>
              <Star className={`h-6 w-6 ${i < rating ? "fill-gold-400 text-gold-400" : "text-ink-600"}`} />
            </button>
          ))}
        </div>
      </div>
      <FormField label="Comment (optional)">
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
      </FormField>
      <Button type="submit" loading={submitting}>Submit Review</Button>
    </form>
  );
}
