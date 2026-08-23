import Link from "next/link";
import Image from "next/image";
import { Facebook, Instagram, Youtube } from "lucide-react";
import { publicApiSafe } from "@/lib/api";

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.6 5.82c-.9-.98-1.4-2.26-1.4-3.57h-3.2v13.35c0 1.6-1.3 2.9-2.9 2.9a2.9 2.9 0 1 1 0-5.8c.3 0 .58.04.85.12V9.6a6.1 6.1 0 0 0-.85-.06 6.1 6.1 0 1 0 6.1 6.1V9.06a8.9 8.9 0 0 0 5.1 1.62v-3.2c-1.35 0-2.6-.44-3.6-1.66Z" />
    </svg>
  );
}

export async function Footer() {
  const [settingsData, branchesData] = await Promise.all([
    publicApiSafe<{ settings: any }>("/api/settings"),
    publicApiSafe<{ branches: any[] }>("/api/branches"),
  ]);
  const settings = settingsData?.settings;
  const branches = branchesData?.branches ?? [];
  const social = settings?.socialLinks ?? {};
  const logoUrl = settings?.logoUrl || "/brand/logo.jpg";

  return (
    <footer className="border-t border-ink-600 bg-ink-900">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <Image src={logoUrl} alt={settings?.siteName || "VIP Mobiles"} width={44} height={44} className="rounded-full" />
            <span className="font-display text-lg font-bold text-cream">{settings?.siteName || "VIP Mobiles"}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">{settings?.tagline || "Smart Phones • Accessories • Services"}</p>
          <div className="mt-4 flex gap-3">
            {social.facebook && (
              <a href={social.facebook} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-gold-400">
                <Facebook className="h-5 w-5" />
              </a>
            )}
            {social.instagram && (
              <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-gold-400">
                <Instagram className="h-5 w-5" />
              </a>
            )}
            {social.tiktok && (
              <a href={social.tiktok} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-gold-400">
                <TikTokIcon className="h-5 w-5" />
              </a>
            )}
            {social.youtube && (
              <a href={social.youtube} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-gold-400">
                <Youtube className="h-5 w-5" />
              </a>
            )}
          </div>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-gold-400">Shop</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li><Link href="/catalog" className="hover:text-cream">All Products</Link></li>
            <li><Link href="/catalog?condition=NEW" className="hover:text-cream">New Phones</Link></li>
            <li><Link href="/catalog?condition=USED" className="hover:text-cream">Used Phones</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-gold-400">Company</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li><Link href="/branches" className="hover:text-cream">Our Branches</Link></li>
            <li><Link href="/about" className="hover:text-cream">About & Team</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-gold-400">Branches</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {branches.slice(0, 4).map((b) => (
              <li key={b.id}>
                <Link href={`/branches/${b.slug}`} className="hover:text-cream">{b.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-ink-600 py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} {settings?.siteName || "VIP Mobiles"}. All rights reserved.
      </div>
    </footer>
  );
}
