import { cn } from "@/lib/utils";

type BadgeTone = "gold" | "green" | "amber" | "red" | "gray" | "blue";

const toneClasses: Record<BadgeTone, string> = {
  gold: "bg-gold-500/15 text-gold-400 border-gold-500/30",
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  red: "bg-red-500/15 text-red-400 border-red-500/30",
  gray: "bg-ink-600/40 text-muted border-ink-600",
  blue: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

export function Badge({ tone = "gray", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", toneClasses[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, BadgeTone> = {
  AVAILABLE: "green",
  RESERVED: "amber",
  SOLD: "red",
  HIDDEN: "gray",
};

export function ProductStatusBadge({ status }: { status: string }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{label}</Badge>;
}

const CONDITION_LABEL: Record<string, string> = {
  NEW: "New",
  USED: "Used",
  REFURBISHED: "Refurbished",
  OPEN_BOX: "Open Box",
};

export function ConditionBadge({ condition }: { condition: string }) {
  return <Badge tone="blue">{CONDITION_LABEL[condition] ?? condition}</Badge>;
}

const BUY_REQUEST_STATUS_TONE: Record<string, BadgeTone> = {
  NEW: "blue",
  ASSIGNED: "amber",
  CONTACTED: "amber",
  ACCEPTED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
  CLOSED: "gray",
};

export function BuyRequestStatusBadge({ status }: { status: string }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return <Badge tone={BUY_REQUEST_STATUS_TONE[status] ?? "gray"}>{label}</Badge>;
}
