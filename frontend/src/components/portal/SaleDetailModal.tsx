"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Receipt, QrCode, Copy, Check, Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { formatCurrency, formatDate } from "@/lib/utils";

interface SaleRow {
  id: string;
  soldPrice: string;
  saleDate: string;
  customerName?: string | null;
  billUrl?: string | null;
  reviewToken?: string | null;
  reviewSubmittedAt?: string | null;
  product: { title: string; slug: string };
  branch?: { name: string } | null;
}

export function SaleDetailModal({ sale, onClose, onUpdated }: { sale: SaleRow; onClose: () => void; onUpdated: (sale: SaleRow) => void }) {
  const [uploadingBill, setUploadingBill] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [reviewUrl, setReviewUrl] = useState<string | null>(sale.reviewToken ? `${window.location.origin}/review/${sale.reviewToken}` : null);
  const [copied, setCopied] = useState(false);

  async function handleBillUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBill(true);
    try {
      const formData = new FormData();
      formData.append("bill", file);
      const { sale: updated } = await clientApi.upload<{ sale: SaleRow }>(`/sales/${sale.id}/bill`, formData);
      toast.success("Bill photo uploaded");
      onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not upload bill photo");
    } finally {
      setUploadingBill(false);
      e.target.value = "";
    }
  }

  async function generateReviewLink() {
    setGeneratingLink(true);
    try {
      const res = await clientApi.post<{ token: string; reviewUrl: string }>(`/sales/${sale.id}/review-link`);
      setReviewUrl(res.reviewUrl);
      onUpdated({ ...sale, reviewToken: res.token });
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not generate review link");
    } finally {
      setGeneratingLink(false);
    }
  }

  async function copyLink() {
    if (!reviewUrl) return;
    try {
      await navigator.clipboard.writeText(reviewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  }

  return (
    <Modal open onClose={onClose} title={sale.product.title}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted">Sold Price</p>
            <p className="font-medium text-cream">{formatCurrency(sale.soldPrice)}</p>
          </div>
          <div>
            <p className="text-muted">Date</p>
            <p className="font-medium text-cream">{formatDate(sale.saleDate)}</p>
          </div>
          <div>
            <p className="text-muted">Customer</p>
            <p className="font-medium text-cream">{sale.customerName || "—"}</p>
          </div>
          <div>
            <p className="text-muted">Branch</p>
            <p className="font-medium text-cream">{sale.branch?.name || "—"}</p>
          </div>
        </div>

        <div className="space-y-2 border-t border-ink-600 pt-4">
          <p className="flex items-center gap-2 text-sm font-medium text-cream"><Receipt className="h-4 w-4 text-gold-400" /> Bill / Invoice Photo</p>
          {sale.billUrl ? (
            <a href={sale.billUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-ink-600">
              <img src={sale.billUrl} alt="Bill" className="max-h-48 w-full object-contain bg-ink-800" />
            </a>
          ) : (
            <p className="text-xs text-muted">No bill photo uploaded yet — kept private, never shown on the storefront.</p>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-muted hover:text-gold-400 hover:border-gold-500/40">
            <Upload className="h-3.5 w-3.5" />
            {uploadingBill ? "Uploading…" : sale.billUrl ? "Replace photo" : "Upload photo"}
            <input type="file" accept="image/*" className="hidden" onChange={handleBillUpload} disabled={uploadingBill} />
          </label>
        </div>

        <div className="space-y-2 border-t border-ink-600 pt-4">
          <p className="flex items-center gap-2 text-sm font-medium text-cream"><QrCode className="h-4 w-4 text-gold-400" /> Customer Review Link</p>
          {sale.reviewSubmittedAt ? (
            <p className="text-xs text-green-400">Customer already submitted a review through this link — thanks!</p>
          ) : reviewUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img src={`/api/sales/${sale.id}/review-qr.png`} alt="Review QR code" className="h-32 w-32 rounded-lg border border-ink-600 bg-white p-1" />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="break-all text-xs text-muted">{reviewUrl}</p>
                  <Button size="sm" variant="outline" onClick={copyLink}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy link"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted">Print this QR on the receipt, or share the link — the customer leaves a verified review tied to this purchase.</p>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={generateReviewLink} loading={generatingLink}>
              <QrCode className="h-3.5 w-3.5" /> Generate review link
            </Button>
          )}
        </div>

        <Button className="w-full" variant="outline" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
