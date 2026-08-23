import { Star } from "lucide-react";
import { ReviewForm } from "./ReviewForm";

interface Review {
  id: string;
  customerName: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < rating ? "fill-gold-400 text-gold-400" : "text-ink-600"}`} />
      ))}
    </div>
  );
}

export function ReviewsSection({ reviews, productId }: { reviews: Review[]; productId: string }) {
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div>
      {reviews.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <span className="font-display text-3xl font-bold text-cream">{avg.toFixed(1)}</span>
          <div>
            <Stars rating={Math.round(avg)} />
            <p className="text-xs text-muted">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-xl2 border border-ink-600 bg-ink-800/40 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-cream">{r.customerName}</span>
              <Stars rating={r.rating} />
            </div>
            {r.comment && <p className="mt-2 text-sm text-muted">{r.comment}</p>}
          </div>
        ))}
        {reviews.length === 0 && <p className="text-sm text-muted">No reviews yet — be the first to share your experience.</p>}
      </div>

      <div className="mt-8">
        <ReviewForm productId={productId} />
      </div>
    </div>
  );
}
