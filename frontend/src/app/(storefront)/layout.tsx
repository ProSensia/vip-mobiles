import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { CompareBar } from "@/components/storefront/CompareBar";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-950">
      <Header />
      <main className="flex-1 pb-16">{children}</main>
      <Footer />
      <CompareBar />
    </div>
  );
}
