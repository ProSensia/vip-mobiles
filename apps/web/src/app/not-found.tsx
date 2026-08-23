import Link from "next/link";
import { Smartphone } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-4 text-center">
      <Smartphone className="h-12 w-12 text-gold-400" strokeWidth={1.5} />
      <h1 className="mt-4 font-display text-3xl font-bold text-cream">Page Not Found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">The page you&apos;re looking for doesn&apos;t exist or may have been moved.</p>
      <Link href="/" className="mt-6 rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-gold-400">
        Back to Homepage
      </Link>
    </div>
  );
}
