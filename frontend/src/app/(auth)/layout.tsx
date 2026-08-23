import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/brand/logo.jpg" alt="VIP Mobiles" width={64} height={64} className="rounded-full" />
          <h1 className="mt-4 font-display text-xl font-bold text-cream">VIP Mobiles</h1>
          <p className="text-sm text-muted">Admin & Sales Dashboard</p>
        </div>
        {children}
      </div>
    </div>
  );
}
