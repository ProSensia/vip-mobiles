"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, QrCode, Fingerprint, Lock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, FormField, Select } from "@/components/ui/Input";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { useCurrentUser } from "@/lib/currentUser";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PERMISSIONS } from "@/shared";

interface Unit {
  id: string;
  qrCode?: string | null;
  imei1?: string | null;
  imei2?: string | null;
  purchasePrice?: string | null;
  status: "IN_STOCK" | "RESERVED" | "SOLD";
  createdAt: string;
}

const STATUS_STYLE: Record<Unit["status"], string> = {
  IN_STOCK: "bg-emerald-500/15 text-emerald-400",
  SOLD: "bg-ink-700 text-muted",
  RESERVED: "bg-gold-500/15 text-gold-400",
};

export function UnitsManager({ productId }: { productId: string }) {
  const { data, loading, refetch } = useFetch<{ units: Unit[] }>(`/products/${productId}/units`);
  const [showAdd, setShowAdd] = useState(false);
  const user = useCurrentUser();
  const canSeeCost = !!user?.permissions.includes(PERMISSIONS.SALES_ANALYTICS);

  async function removeUnit(unitId: string) {
    try {
      await clientApi.delete(`/products/${productId}/units/${unitId}`);
      toast.success("Unit removed");
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not remove unit");
    }
  }

  const units = data?.units ?? [];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Each scanned unit is one physical phone. Stock is simply the count of units still marked{" "}
        <span className="font-medium text-emerald-400">In Stock</span> below — selling one only ever affects that one unit.
      </p>

      {units.length > 0 && (
        <div className="space-y-2">
          {units.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-800/40 p-3">
              <div className="flex items-center gap-2 text-sm text-cream">
                {u.qrCode ? <QrCode className="h-4 w-4 shrink-0 text-gold-400" /> : <Fingerprint className="h-4 w-4 shrink-0 text-gold-400" />}
                <div>
                  <p className="font-mono text-xs">{u.qrCode || u.imei1}</p>
                  {u.imei2 && <p className="font-mono text-[10px] text-muted">IMEI2: {u.imei2}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {canSeeCost && <span className="text-muted">{u.purchasePrice ? formatCurrency(u.purchasePrice) : "No cost set"}</span>}
                <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLE[u.status]}`}>{u.status.replace("_", " ")}</span>
                <span className="text-muted">{formatDate(u.createdAt)}</span>
                {u.status === "IN_STOCK" && (
                  <button onClick={() => removeUnit(u.id)} aria-label="Remove unit">
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && units.length === 0 && (
        <p className="text-sm text-muted">No units scanned in yet — this product&apos;s availability is controlled by Stock Status above.</p>
      )}

      <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
        <Plus className="h-4 w-4" /> Scan In a Unit
      </Button>

      {showAdd && <AddUnitModal productId={productId} canSeeCost={canSeeCost} onClose={() => setShowAdd(false)} onSaved={refetch} />}
    </div>
  );
}

function AddUnitModal({
  productId,
  canSeeCost,
  onClose,
  onSaved,
}: {
  productId: string;
  canSeeCost: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<"scan" | "details">("scan");
  const [codeType, setCodeType] = useState<"qr" | "imei">("qr");
  const [code, setCode] = useState("");
  const [imei2, setImei2] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [saving, setSaving] = useState(false);

  function handleScanned(value: string) {
    setCode(value);
    // A 14-16 digit code is almost certainly an IMEI, not a QR payload — a sensible default, still editable below.
    setCodeType(/^\d{14,16}$/.test(value) ? "imei" : "qr");
    setStep("details");
  }

  async function save() {
    setSaving(true);
    try {
      await clientApi.post(`/products/${productId}/units`, {
        qrCode: codeType === "qr" ? code : undefined,
        imei1: codeType === "imei" ? code : undefined,
        imei2: codeType === "imei" && imei2 ? imei2 : undefined,
        purchasePrice: canSeeCost && purchasePrice ? Number(purchasePrice) : undefined,
      });
      toast.success("Unit added — stock updated");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not add this unit — check it isn't already registered");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Scan In a Unit">
      {step === "scan" ? (
        <BarcodeScanner onDetected={handleScanned} />
      ) : (
        <div className="space-y-4">
          <FormField label="This code is a">
            <Select value={codeType} onChange={(e) => setCodeType(e.target.value as "qr" | "imei")}>
              <option value="qr">QR / Barcode — new mobile, from the box</option>
              <option value="imei">IMEI — used mobile, from *#06#</option>
            </Select>
          </FormField>
          <FormField label={codeType === "qr" ? "QR / Barcode" : "IMEI 1"}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" autoFocus />
          </FormField>
          {codeType === "imei" && (
            <FormField label="IMEI 2 (dual-SIM, optional)">
              <Input value={imei2} onChange={(e) => setImei2(e.target.value)} className="font-mono" />
            </FormField>
          )}
          {canSeeCost ? (
            <FormField label="Purchase Price (private)" hint="Never shown to sellers or customers">
              <Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            </FormField>
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Lock className="h-3.5 w-3.5" /> Purchase price is only visible to roles with financial access.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStep("scan")}>Rescan</Button>
            <Button className="w-full sm:flex-1" onClick={save} loading={saving} disabled={!code}>Save Unit</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
