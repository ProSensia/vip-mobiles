import Link from "next/link";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import { publicApiSafe } from "@/lib/api";
import { MobileNav } from "./MobileNav";
import { NAV_LINKS } from "./navLinks";

export async function Header() {
  const data = await publicApiSafe<{ settings: any }>("/api/settings");
  const settings = data?.settings;
  const logoUrl = settings?.logoUrl || "/brand/logo.jpg";
  const whatsapp = (settings?.whatsappNumber || "").replace(/[^\d]/g, "");

  return (
    <header className="sticky top-0 z-40 border-b border-ink-600 bg-ink-950/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src={logoUrl} alt={settings?.siteName || "VIP Mobiles"} width={40} height={40} className="rounded-full" priority />
          <span className="font-display text-lg font-bold tracking-wide text-cream">
            {settings?.siteName || "VIP Mobiles"}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-cream/80 transition-colors hover:text-gold-400">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-xl bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 shadow-gold transition-colors hover:bg-gold-400 sm:flex"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp Us
            </a>
          )}
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
