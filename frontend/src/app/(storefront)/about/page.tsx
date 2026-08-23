import type { Metadata } from "next";
import Image from "next/image";
import { publicApiSafe } from "@/lib/api";

export const metadata: Metadata = {
  title: "About & Team",
  description: "Meet the VIP Mobiles team and learn what makes us a trusted name in smartphones and service.",
};

export default async function AboutPage() {
  const [settingsData, branchesData] = await Promise.all([
    publicApiSafe<{ settings: any }>("/api/settings"),
    publicApiSafe<{ branches: any[] }>("/api/branches"),
  ]);
  const settings = settingsData?.settings;
  const branches = branchesData?.branches ?? [];
  const team = branches.flatMap((b) => (b.staffProfiles ?? []).map((s: any) => ({ ...s, branchName: b.name })));

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-bold text-cream">About {settings?.siteName || "VIP Mobiles"}</h1>
      <p className="mt-3 max-w-2xl text-muted">
        {settings?.tagline || "Smart Phones • Accessories • Services"} — we bring genuine, quality-checked smartphones and
        dependable after-sales support to every customer, across all our branches.
      </p>

      {team.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-6 font-display text-2xl font-bold text-cream">Meet the Team</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member: any) => (
              <div key={member.id} className="rounded-xl2 border border-ink-600 bg-ink-800/40 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-ink-900 text-lg font-bold text-gold-400">
                    {member.photoUrl ? (
                      <Image src={member.photoUrl} alt={member.user?.name ?? ""} width={56} height={56} className="h-full w-full object-cover" />
                    ) : (
                      member.user?.name?.charAt(0)
                    )}
                  </div>
                  <div>
                    <p className="font-display font-semibold text-cream">{member.user?.name}</p>
                    <p className="text-sm text-gold-400">{member.position}</p>
                    <p className="text-xs text-muted">{member.branchName}</p>
                  </div>
                </div>
                {member.bio && <p className="mt-3 text-sm text-muted">{member.bio}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
