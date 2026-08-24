"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { clientApi, ClientApiError } from "@/lib/clientApi";

interface ValidateResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  createCount: number;
  updateCount: number;
  errors: Array<{ row: number; message: string }>;
  preview: Array<{ row: number; sku: string | null; title: string; basePrice: number; willUpdate: boolean }>;
}

interface ConfirmResult {
  created: number;
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

export function ProductImportExportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validation, setValidation] = useState<ValidateResult | null>(null);
  const [result, setResult] = useState<ConfirmResult | null>(null);

  function pickFile(f: File | null) {
    setFile(f);
    setValidation(null);
    setResult(null);
  }

  async function runValidate() {
    if (!file) return;
    setValidating(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await clientApi.upload<ValidateResult>("/products/import/validate", formData);
      setValidation(res);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not read this file");
    } finally {
      setValidating(false);
    }
  }

  async function runConfirm() {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await clientApi.upload<ConfirmResult>("/products/import/confirm", formData);
      setResult(res);
      toast.success(`Imported: ${res.created} created, ${res.updated} updated`);
      onImported();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Import / Export Products">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <a href="/api/products/import-template.xlsx">
            <Button variant="outline" size="sm"><FileSpreadsheet className="h-4 w-4" /> Download Template</Button>
          </a>
          <a href="/api/products/export.xlsx">
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /> Export All Products</Button>
          </a>
        </div>

        <div className="space-y-3 border-t border-ink-600 pt-4">
          <p className="text-sm font-medium text-cream">Bulk Import</p>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-muted hover:text-gold-400 hover:border-gold-500/40">
            <Upload className="h-4 w-4" />
            {file ? file.name : "Choose .xlsx file"}
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {file && !validation && (
            <Button size="sm" onClick={runValidate} loading={validating}>Check File</Button>
          )}

          {validation && !result && (
            <div className="space-y-3 rounded-xl border border-ink-600 bg-ink-800/40 p-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-cream">{validation.totalRows} rows</span>
                <span className="text-emerald-400">{validation.createCount} new</span>
                <span className="text-blue-400">{validation.updateCount} updates</span>
                {validation.errorCount > 0 && <span className="text-red-400">{validation.errorCount} errors</span>}
              </div>

              {validation.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg bg-ink-900/60 p-2">
                  {validation.errors.map((e, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-xs text-red-400">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> Row {e.row}: {e.message}
                    </p>
                  ))}
                </div>
              )}

              {validation.validCount > 0 ? (
                <Button size="sm" onClick={runConfirm} loading={importing}>
                  Confirm Import ({validation.validCount} rows)
                </Button>
              ) : (
                <p className="text-xs text-muted">Fix the errors above and re-check the file.</p>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Import complete
              </p>
              <p className="text-xs text-cream/90">
                {result.created} created · {result.updated} updated
                {result.skipped > 0 ? ` · ${result.skipped} skipped (invalid)` : ""}
                {result.failed > 0 ? ` · ${result.failed} failed` : ""}
              </p>
            </div>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
