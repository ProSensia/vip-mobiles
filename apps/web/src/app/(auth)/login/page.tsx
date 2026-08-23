"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { clientApi, ClientApiError } from "@/lib/clientApi";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await clientApi.post<{ user: any }>("/auth/login", { email, password });
      const next = searchParams.get("next");
      const salesOnly = user.role === "SALES_STAFF" || user.role === "SALES_MANAGER";
      router.push(next || (salesOnly ? "/portal" : "/admin"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </FormField>
          <FormField label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </FormField>
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            <LogIn className="h-4 w-4" /> Sign In
          </Button>
          <div className="text-center">
            <Link href="/forgot-password" className="text-xs text-muted hover:text-gold-400">Forgot your password?</Link>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
