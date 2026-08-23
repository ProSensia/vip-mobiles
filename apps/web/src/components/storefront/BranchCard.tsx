import Link from "next/link";
import { MapPin, Phone, Clock } from "lucide-react";

export interface BranchCardData {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  phone?: string | null;
  openingHours?: Record<string, string> | null;
}

export function BranchCard({ branch }: { branch: BranchCardData }) {
  return (
    <Link
      href={`/branches/${branch.slug}`}
      className="block rounded-xl2 border border-ink-600 bg-ink-800/60 p-5 transition-colors hover:border-gold-500/50"
    >
      <h3 className="font-display text-base font-semibold text-cream">{branch.name}</h3>
      <div className="mt-3 space-y-2 text-sm text-muted">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
          {branch.address}, {branch.city}
        </p>
        {branch.phone && (
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-gold-400" />
            {branch.phone}
          </p>
        )}
        {branch.openingHours?.mon_sat && (
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-gold-400" />
            Mon–Sat: {branch.openingHours.mon_sat}
          </p>
        )}
      </div>
    </Link>
  );
}
