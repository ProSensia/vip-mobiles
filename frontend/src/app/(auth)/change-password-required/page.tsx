"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { clientApi, ClientApiError } from "@/lib/clientApi";

export default function ChangePasswordRequiredPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await clientApi.post("/auth/change-password", { currentPassword, newPassword });
      toast.success("Password updated");
      const { user } = await clientApi.get<{ user: { role: string } }>("/auth/me");
      const salesOnly = user.role === "SALES_STAFF" || user.role === "SALES_MANAGER";
      router.push(salesOnly ? "/portal" : "/admin");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
          <p className="text-sm text-cream/90">Your account was set up with a temporary password. Set a new one to continue.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Temporary Password">
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoFocus autoComplete="current-password" />
          </FormField>
          <FormField label="New Password" hint="At least 8 characters, with a letter and a number.">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password" />
          </FormField>
          <FormField label="Confirm New Password">
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
          </FormField>
          <Button type="submit" className="w-full" size="lg" loading={loading}>Set Password &amp; Continue</Button>
        </form>
      </CardBody>
    </Card>
  );
}
