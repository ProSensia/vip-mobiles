import type { Metadata } from "next";
import { publicApiSafe } from "@/lib/api";
import { BranchCard } from "@/components/storefront/BranchCard";

export const metadata: Metadata = {
  title: "Our Branches",
  description: "Find a VIP Mobiles branch near you — addresses, contact numbers and opening hours.",
};

export default async function BranchesPage() {
  const data = await publicApiSafe<{ branches: any[] }>("/api/branches");
  const branches = data?.branches ?? [];

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-bold text-cream">Our Branches</h1>
      <p className="mt-1 text-sm text-muted">Visit us in person — genuine devices, expert advice, trusted service.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => <BranchCard key={b.id} branch={b} />)}
      </div>
    </div>
  );
}
