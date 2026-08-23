"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-4 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400" strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-2xl font-bold text-cream">Something went wrong</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">Please try again, or head back to the homepage.</p>
        <button onClick={() => reset()} className="mt-6 rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-gold-400">
          Try Again
        </button>
      </body>
    </html>
  );
}
