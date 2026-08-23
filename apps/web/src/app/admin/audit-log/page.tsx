"use client";

import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { useFetch } from "@/lib/useFetch";
import { formatDate } from "@/lib/utils";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
}

export default function AuditLogPage() {
  const { data, loading } = useFetch<{ items: AuditEntry[] }>("/audit-logs?limit=100");

  const columns: Column<AuditEntry>[] = [
    { key: "when", header: "When", render: (e) => formatDate(e.createdAt) },
    { key: "user", header: "User", render: (e) => e.user?.name ?? "System" },
    { key: "action", header: "Action", render: (e) => <code className="text-xs text-gold-400">{e.action}</code> },
    { key: "entity", header: "Entity", render: (e) => `${e.entityType}${e.entityId ? ` #${e.entityId.slice(0, 8)}` : ""}` },
  ];

  return (
    <div>
      <PageHeader title="Audit Log" description="A record of administrative actions taken across the system." />
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyTitle="No activity recorded yet" />
    </div>
  );
}
