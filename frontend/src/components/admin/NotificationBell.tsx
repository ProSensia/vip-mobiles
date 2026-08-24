"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
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

// Polled, not pushed — true WebSocket push isn't a good fit for this
// hosting environment (shared hosting behind Passenger, single worker
// process, no infrastructure for long-lived connections), and a 45s poll of
// one cheap indexed count query is a negligible cost compared to the
// benefit. Only the count is polled continuously; the full list is fetched
// on demand when the panel opens.
const POLL_INTERVAL_MS = 45_000;

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const { count } = await clientApi.get<{ count: number }>("/notifications/unread-count");
      setUnreadCount(count);
    } catch {
      // Silent — a failed poll shouldn't surface as an error toast; it'll just retry next tick.
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function openPanel() {
    setOpen((o) => !o);
    if (!open) {
      setLoadingList(true);
      try {
        const { items } = await clientApi.get<{ items: NotificationItem[] }>("/notifications?limit=10");
        setItems(items);
      } finally {
        setLoadingList(false);
      }
    }
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await clientApi.patch("/notifications/read-all", {});
  }

  async function handleClick(n: NotificationItem) {
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      clientApi.patch(`/notifications/${n.id}/read`, {});
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={openPanel}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-cream hover:bg-ink-800"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-ink-950">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-1/2 top-16 z-50 w-[calc(100vw-2rem)] max-w-xs -translate-x-1/2 overflow-hidden rounded-xl border border-ink-600 bg-ink-900 shadow-card sm:absolute sm:left-auto sm:top-11 sm:right-0 sm:w-80 sm:max-w-none sm:translate-x-0">
          <div className="flex items-center justify-between border-b border-ink-600 px-4 py-3">
            <p className="text-sm font-semibold text-cream">Notifications</p>
            {items.some((n) => !n.isRead) && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-medium text-gold-400 hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loadingList ? (
              <p className="p-4 text-center text-sm text-muted">Loading...</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "block w-full border-b border-ink-600/50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-ink-800",
                    !n.isRead && "bg-gold-500/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />}
                    <div className={cn("min-w-0 flex-1", n.isRead && "pl-3.5")}>
                      <p className="truncate text-sm font-medium text-cream">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.message}</p>
                      <p className="mt-1 text-[10px] text-muted/70">{formatDate(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <Link
            href="/admin/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-ink-600 px-4 py-2.5 text-center text-xs font-medium text-gold-400 hover:bg-ink-800"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
