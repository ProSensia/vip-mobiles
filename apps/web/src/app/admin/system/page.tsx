"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, FormField } from "@/components/ui/Input";
import { StatCard } from "@/components/admin/StatCard";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { Smartphone, Tags, LayoutGrid, Palette, Building2, Users, TrendingUp } from "lucide-react";

interface Summary {
  products: number;
  brands: number;
  categories: number;
  colors: number;
  branches: number;
  users: number;
  sales: number;
  reviews: number;
}

export default function SystemPage() {
  const { data, loading, refetch } = useFetch<Summary>("/system/demo-data-summary");
  const [modalOpen, setModalOpen] = useState(false);

  const total = data ? Object.values(data).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Go-Live Setup" description="Remove all demo/sample data before handing this site to the client." />

      <Card className="border-amber-500/30">
        <CardHeader title="Demo Data Currently in the System" subtitle="These records were created by the initial seed script and are safe to remove at any time." />
        <CardBody>
          {loading || !data ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Products" value={data.products} icon={Smartphone} />
              <StatCard label="Brands" value={data.brands} icon={Tags} />
              <StatCard label="Categories" value={data.categories} icon={LayoutGrid} />
              <StatCard label="Colors" value={data.colors} icon={Palette} />
              <StatCard label="Branches" value={data.branches} icon={Building2} />
              <StatCard label="Staff Accounts" value={data.users} icon={Users} />
              <StatCard label="Sales Records" value={data.sales} icon={TrendingUp} tone="green" />
            </div>
          )}

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="text-sm text-amber-200">
              This permanently deletes all demo products, brands, categories, colors, branches, staff accounts and sales
              records. Your own Super Admin account and any real content you&apos;ve already entered are preserved.
            </div>
          </div>

          <Button
            variant="destructive"
            className="mt-4"
            disabled={total === 0}
            onClick={() => setModalOpen(true)}
          >
            <RotateCcw className="h-4 w-4" /> Reset Demo Data
          </Button>
        </CardBody>
      </Card>

      {modalOpen && <ConfirmResetModal onClose={() => setModalOpen(false)} onDone={refetch} />}
    </div>
  );
}

function ConfirmResetModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await clientApi.post("/system/reset-demo-data", { password, confirmText });
      toast.success("Demo data removed. The site is ready for production use.");
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not reset demo data");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Confirm Demo Data Reset">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted">This action cannot be undone. Please confirm your identity to proceed.</p>
        <FormField label="Your Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </FormField>
        <FormField label='Type "RESET DEMO DATA" to confirm'>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} required />
        </FormField>
        <Button type="submit" variant="destructive" className="w-full" loading={submitting} disabled={confirmText !== "RESET DEMO DATA"}>
          Permanently Delete Demo Data
        </Button>
      </form>
    </Modal>
  );
}
