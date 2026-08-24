"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Star, Check, Trash2, Eye, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BuyRequestStatusBadge } from "@/components/ui/Badge";
import { BuyRequestDetailModal } from "@/components/admin/BuyRequestDetailModal";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { formatDate } from "@/lib/utils";

interface PendingReview {
  id: string;
  customerName: string;
  rating: number;
  comment?: string | null;
  photoUrl?: string | null;
  isVerified?: boolean;
  createdAt: string;
  product: { id: string; title: string; slug: string; images: Array<{ thumbUrl?: string | null; url: string }> };
}

interface PendingBuyRequest {
  id: string;
  customerName: string;
  contact: string;
  status: string;
  createdAt: string;
  product: { id: string; title: string; slug: string };
}

// One place to see everything waiting on an admin decision — previously
// reviews could only be approved from inside each product's edit page one
// at a time, with no single list of what's actually pending across the
// whole catalog. Buy Request handling itself still lives on its own page;
// this surfaces the *new/unhandled* ones so they aren't missed.
export default function ApprovalsPage() {
  const { data: reviewData, loading: reviewsLoading, refetch: refetchReviews } = useFetch<{ reviews: PendingReview[] }>("/reviews/pending");
  const { data: requestData, loading: requestsLoading, refetch: refetchRequests } = useFetch<{ requests: PendingBuyRequest[] }>("/buy-requests?status=NEW");
  const { data: meData } = useFetch<{ user: any }>("/auth/me");
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);

  const canRefer = Boolean(meData?.user?.permissions?.includes("buyRequests.refer"));

  async function approveReview(r: PendingReview) {
    try {
      await clientApi.patch(`/products/${r.product.id}/reviews/${r.id}/approve`, {});
      toast.success("Review approved");
      refetchReviews();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not approve review");
    }
  }

  async function rejectReview(r: PendingReview) {
    try {
      await clientApi.delete(`/products/${r.product.id}/reviews/${r.id}`);
      toast.success("Review rejected");
      refetchReviews();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not reject review");
    }
  }

  const reviews = reviewData?.reviews ?? [];
  const requests = requestData?.requests ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title="Approvals & Requests" description="Everything waiting on a decision — pending reviews and new, unhandled buy requests." />

      <Card>
        <CardHeader title="Pending Reviews" subtitle={`${reviews.length} awaiting moderation`} />
        <CardBody className="space-y-3">
          {reviewsLoading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-muted">No reviews waiting for approval.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-600 bg-ink-800/40 p-4">
                <div className="flex items-start gap-3">
                  {r.photoUrl && <img src={r.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-cream">{r.customerName}</span>
                      <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-gold-400 text-gold-400" : "text-ink-600"}`} />)}</div>
                      {r.isVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">on {r.product.title} · {formatDate(r.createdAt)}</p>
                    {r.comment && <p className="mt-1 text-xs text-cream/80">{r.comment}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => approveReview(r)}><Check className="h-3.5 w-3.5 text-emerald-400" /></Button>
                  <Button size="sm" variant="outline" onClick={() => rejectReview(r)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="New Buy Requests" subtitle={`${requests.length} not yet assigned or handled`} />
        <CardBody className="space-y-3">
          {requestsLoading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted">No new buy requests.</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-800/40 p-4">
                <div>
                  <p className="text-sm font-medium text-cream">{r.customerName} — {r.product.title}</p>
                  <p className="text-xs text-muted">{r.contact} · {formatDate(r.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <BuyRequestStatusBadge status={r.status} />
                  <Button size="sm" variant="ghost" onClick={() => setOpenRequestId(r.id)}><Eye className="h-4 w-4" /> View</Button>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {openRequestId && (
        <BuyRequestDetailModal
          requestId={openRequestId}
          canRefer={canRefer}
          onClose={() => setOpenRequestId(null)}
          onChanged={refetchRequests}
        />
      )}
    </div>
  );
}
