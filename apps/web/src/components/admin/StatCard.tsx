import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "gold",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "gold" | "green" | "red" | "blue";
}) {
  const toneClass = {
    gold: "bg-gold-500/15 text-gold-400",
    green: "bg-emerald-500/15 text-emerald-400",
    red: "bg-red-500/15 text-red-400",
    blue: "bg-sky-500/15 text-sky-400",
  }[tone];

  return (
    <div className="rounded-xl2 border border-ink-600 bg-ink-800/60 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneClass)}>
          <Icon className="h-4.5 w-[18px]" />
        </div>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-cream">{value}</p>
    </div>
  );
}
