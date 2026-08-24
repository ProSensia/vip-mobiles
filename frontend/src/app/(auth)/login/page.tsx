"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { LogIn, RefreshCw } from "lucide-react";
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
  const [captcha, setCaptcha] = useState<{ id: string; question: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const loadCaptcha = useCallback(async () => {
    setCaptchaAnswer("");
    try {
      const c = await clientApi.get<{ id: string; question: string }>("/auth/captcha");
      setCaptcha(c);
    } catch {
      // A failed challenge fetch shouldn't block the form from rendering — the login
      // submit will simply fail server-side and the user can retry via "New question".
    }
  }, []);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!captcha) {
      toast.error("Verification question failed to load — please wait a moment and try again");
      loadCaptcha();
      return;
    }
    setLoading(true);
    try {
      const { user } = await clientApi.post<{ user: any }>("/auth/login", {
        email,
        password,
        captchaId: captcha.id,
        captchaAnswer,
      });
      const next = searchParams.get("next");
      const salesOnly = user.role === "SALES_STAFF" || user.role === "SALES_MANAGER";
      router.push(next || (salesOnly ? "/portal" : "/admin"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Login failed");
      loadCaptcha();
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
          <FormField label={captcha ? `Verification — what is ${captcha.question}?` : "Verification"}>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="numeric"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                required
                disabled={!captcha}
                placeholder={captcha ? undefined : "Loading…"}
              />
              <button
                type="button"
                onClick={loadCaptcha}
                title="New question"
                aria-label="New verification question"
                className="shrink-0 rounded-lg border border-white/10 p-2.5 text-muted hover:text-gold-400 hover:border-gold-500/40"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
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
