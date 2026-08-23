import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { MapPin, Phone, Clock, MessageCircle } from "lucide-react";
import { publicApiSafe } from "@/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

async function getBranch(slug: string) {
  return publicApiSafe<{ branch: any }>(`/api/branches/${slug}`);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBranch(slug);
  if (!data) return {};
  const { branch } = data;
  const title = branch.metaTitle || `${branch.name} – VIP Mobiles Branch`;
  const description = branch.metaDescription || `Visit VIP Mobiles at ${branch.address}, ${branch.city}. ${branch.phone ? `Call ${branch.phone}.` : ""}`;
  return { title, description, alternates: { canonical: `${SITE_URL}/branches/${branch.slug}` } };
}

export default async function BranchDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getBranch(slug);
  if (!data) notFound();
  const { branch } = data;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MobilePhoneStore",
    name: branch.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: branch.address,
      addressLocality: branch.city,
      addressRegion: branch.state ?? undefined,
      addressCountry: branch.country ?? undefined,
    },
    telephone: branch.phone ?? undefined,
    ...(branch.lat && branch.lng ? { geo: { "@type": "GeoCoordinates", latitude: branch.lat, longitude: branch.lng } } : {}),
  };

  return (
    <div className="container-page py-10">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {branch.imageUrl && (
        <div className="relative mb-8 aspect-[16/6] overflow-hidden rounded-xl2 border border-ink-600">
          <Image src={branch.imageUrl} alt={branch.name} fill className="object-cover" priority />
        </div>
      )}

      <h1 className="font-display text-3xl font-bold text-cream">{branch.name}</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <p className="flex items-start gap-2 text-cream/90">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" /> {branch.address}, {branch.city}
            {branch.state ? `, ${branch.state}` : ""}
          </p>
          {branch.phone && (
            <p className="flex items-center gap-2 text-cream/90">
              <Phone className="h-5 w-5 shrink-0 text-gold-400" /> {branch.phone}
            </p>
          )}
          {branch.openingHours && (
            <div className="flex items-start gap-2 text-cream/90">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
              <div className="text-sm">
                {Object.entries(branch.openingHours as Record<string, string>).map(([k, v]) => (
                  <p key={k}>{k.replace(/_/g, "–").replace(/\b\w/g, (c) => c.toUpperCase())}: {v}</p>
                ))}
              </div>
            </div>
          )}
          {branch.mapUrl && (
            <a href={branch.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-gold-500/50 px-4 py-2 text-sm font-semibold text-gold-400 hover:bg-gold-500/10">
              Get Directions
            </a>
          )}
          {branch.whatsapp && (
            <a
              href={`https://wa.me/${branch.whatsapp.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 inline-flex items-center gap-2 rounded-xl bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-gold-400"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp This Branch
            </a>
          )}
        </div>

        {branch.staffProfiles?.length > 0 && (
          <div>
            <h2 className="mb-3 font-display text-lg font-bold text-cream">Meet the Team</h2>
            <div className="space-y-3">
              {branch.staffProfiles.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-800/40 p-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-ink-900 text-sm font-bold text-gold-400">
                    {s.user?.avatarUrl ? (
                      <Image src={s.user.avatarUrl} alt={s.user.name} width={40} height={40} className="h-full w-full object-cover" />
                    ) : (
                      s.user?.name?.charAt(0)
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-cream">{s.user?.name}</p>
                    <p className="text-xs text-muted">{s.position}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
