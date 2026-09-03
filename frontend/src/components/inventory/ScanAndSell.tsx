"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ScanLine, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormField, Textarea } from "@/components/ui/Input";
import { BarcodeScanner } from "./BarcodeScanner";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { useCurrentUser } from "@/lib/currentUser";
import { formatCurrency } from "@/lib/utils";
import { PERMISSIONS } from "@/shared";

interface LookupResult {
  unit: { id: string; imei1: string | null; imei2: string | null; qrCode: string | null };
  product: {
    id: string;
    title: string;
    condition: string;
    basePrice: string;
    brand: { name: string };
    category: { name: string };
    images: Array<{ thumbUrl?: string | null; url: string }>;
  };
  variant: { id: string; storage?: string | null; ram?: string | null; color?: { name: string } | null } | null;
  branch: { id: string; name: string } | null;
}

interface SaleResult {
  id: string;
  soldPrice: string;
  costPrice: string | null;
  profit: string | null;
}

type Stage = "scan" | "confirm" | "done";

// Shared by /admin/scan and /portal/scan — the whole point is one flow
// that behaves identically for both roles, with visibility (not logic)
// differing by permission: a seller sees exactly the same screens, just
// without the cost/profit figures a SALES_ANALYTICS holder gets back.
export function ScanAndSell() {
  const [stage, setStage] = useState<Stage>("scan");
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [soldPrice, setSoldPrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sale, setSale] = useState<SaleResult | null>(null);

  const user = useCurrentUser();
  const canSeeCost = !!user?.permissions.includes(PERMISSIONS.SALES_ANALYTICS);

  async function handleScanned(code: string) {
    setLooking(true);
    setLookupError(null);
    try {
      const res = await clientApi.post<LookupResult>("/inventory/lookup", { code });
      setResult(res);
      setSoldPrice(res.product.basePrice);
      setStage("confirm");
    } catch (err) {
      setLookupError(err instanceof ClientApiError ? err.message : "Could not look up this code");
    } finally {
      setLooking(false);
    }
  }

  async function confirmSale() {
    if (!result || confirming) return;
    setConfirming(true);
    try {
      const res = await clientApi.post<{ sale: SaleResult }>(`/inventory/units/${result.unit.id}/sell`, {
        soldPrice: Number(soldPrice),
        customerName: customerName || undefined,
        customerContact: customerContact || undefined,
        notes: notes || undefined,
      });
      setSale(res.sale);
      setStage("done");
      toast.success("Sale completed");
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not complete this sale");
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    setStage("scan");
    setResult(null);
    setLookupError(null);
    setSoldPrice("");
    setCustomerName("");
    setCustomerContact("");
    setNotes("");
    setSale(null);
  }

  return (
    <Card>
      <CardBody className="mx-auto max-w-md">
        {stage === "scan" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-cream">
              <ScanLine className="h-4 w-4 text-gold-400" /> Scan a mobile&apos;s QR/barcode or IMEI
            </div>
            {lookupError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {lookupError}
              </div>
            )}
            {looking ? (
              <p className="text-sm text-muted">Looking up this code…</p>
            ) : (
              <BarcodeScanner onDetected={handleScanned} />
            )}
          </div>
        )}

        {stage === "confirm" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-800/40 p-3">
              {result.product.images[0] && (
                <img src={result.product.images[0].thumbUrl || result.product.images[0].url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-cream">{result.product.title}</p>
                <p className="text-xs text-muted">
                  {result.product.brand.name} · {[result.variant?.color?.name, result.variant?.storage].filter(Boolean).join(" / ") || result.product.condition}
                </p>
                {result.branch && <p className="text-xs text-muted">{result.branch.name}</p>}
                <p className="font-mono text-[10px] text-muted">{result.unit.qrCode || result.unit.imei1}</p>
              </div>
            </div>

            <FormField label="Selling Price">
              <Input type="number" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} required autoFocus />
            </FormField>
            <FormField label="Customer Name (optional)">
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </FormField>
            <FormField label="Customer Contact (optional)">
              <Input value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} />
            </FormField>
            <FormField label="Notes (optional)">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </FormField>

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}><RotateCcw className="h-4 w-4" /> Rescan</Button>
              <Button className="flex-1" onClick={confirmSale} loading={confirming} disabled={!soldPrice}>
                Confirm Sale
              </Button>
            </div>
          </div>
        )}

        {stage === "done" && sale && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <div>
              <p className="text-lg font-semibold text-cream">Sale completed</p>
              <p className="mt-1 text-sm text-muted">Sold for {formatCurrency(sale.soldPrice)}</p>
              {canSeeCost && sale.profit != null && (
                <p className="mt-1 text-sm font-medium text-gold-400">Profit: {formatCurrency(sale.profit)}</p>
              )}
            </div>
            <Button className="w-full" onClick={reset}><ScanLine className="h-4 w-4" /> Scan Next Mobile</Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
