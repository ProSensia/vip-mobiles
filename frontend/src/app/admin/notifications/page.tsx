"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFetch } from "@/lib/useFetch";
import { clientApi } from "@/lib/clientApi";
import { cn, formatDate } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data, loading, refetch, setData } = useFetch<{ items: NotificationItem[] }>("/notifications?limit=50");

  async function markAllRead() {
    if (!data) return;
    setData({ items: data.items.map((n) => ({ ...n, isRead: true })) });
    await clientApi.patch("/notifications/read-all", {});
  }

  async function handleClick(n: NotificationItem) {
    if (!n.isRead && data) {
      setData({ items: data.items.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) });
      clientApi.patch(`/notifications/${n.id}/read`, {});
    }
    if (n.link) router.push(n.link);
  }

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Updates on buy requests, referrals, sales, reviews and stock."
        action={
          items.some((n) => !n.isRead) ? (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted">Loading...</p>
          ) : items.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications yet" description="You'll see updates on buy requests, sales and reviews here." />
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "block w-full border-b border-ink-600/50 px-5 py-4 text-left transition-colors last:border-0 hover:bg-ink-800",
                  !n.isRead && "bg-gold-500/5"
                )}
              >
                <div className="flex items-start gap-3">
                  {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold-400" />}
                  <div className={cn("min-w-0 flex-1", n.isRead && "pl-5")}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-cream">{n.title}</p>
                      <p className="shrink-0 text-xs text-muted">{formatDate(n.createdAt)}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted">{n.message}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
