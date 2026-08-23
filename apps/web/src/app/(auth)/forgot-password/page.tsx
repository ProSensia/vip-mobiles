"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { clientApi, ClientApiError } from "@/lib/clientApi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await clientApi.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardBody>
        {sent ? (
          <p className="text-center text-sm text-emerald-400">If that email is registered, a reset link has been sent.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Email" hint="We'll send you a link to reset your password.">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </FormField>
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              <Mail className="h-4 w-4" /> Send Reset Link
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
