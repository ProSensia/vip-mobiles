"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { clientApi, ClientApiError } from "@/lib/clientApi";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await clientApi.post("/auth/reset-password", { token, newPassword: password });
      toast.success("Password updated. Please sign in.");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-center text-sm text-red-400">This reset link is missing a token. Please request a new one.</p>;
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="New Password" hint="At least 8 characters, with a letter and a number.">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          </FormField>
          <FormField label="Confirm Password">
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </FormField>
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            <KeyRound className="h-4 w-4" /> Set New Password
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
