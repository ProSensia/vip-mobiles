import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

export interface Column<T> {
  header: string;
  key: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  emptyTitle = "No records yet",
  emptyDescription,
  emptyAction,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl2 border border-ink-600">
        <div className="divide-y divide-ink-600">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-4">
              <Skeleton className="h-10 w-10 shrink-0" />
              <Skeleton className="h-10 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className="overflow-x-auto rounded-xl2 border border-ink-600 scrollbar-thin">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-ink-600 bg-ink-800/60">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 font-medium text-muted ${col.className ?? ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-600">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-ink-800/40">
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 text-cream/90 ${col.className ?? ""}`}>
                  {col.render ? col.render(row) : (row as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
