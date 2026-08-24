"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
const PANEL_WIDTH = 320; // px, matches w-80
const VIEWPORT_MARGIN = 16;

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // The admin header this button sits in uses backdrop-blur, which makes it
  // a containing block for position:fixed descendants — a fixed dropdown
  // nested inside it would resolve against the header's own box, not the
  // viewport, and get clipped/misplaced on narrow screens. Portaling to
  // document.body and computing screen coordinates from the button's own
  // rect sidesteps that entirely and keeps the panel fully on-screen at any
  // width, anchored near the bell rather than off-screen or overlapping it.
  const updateCoords = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const left = Math.min(
      Math.max(rect.right - width, VIEWPORT_MARGIN),
      window.innerWidth - width - VIEWPORT_MARGIN
    );
    setCoords({ top: rect.bottom + 8, left, width });
  }, []);

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
      const target = e.target as Node;
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        (!panelRef.current || !panelRef.current.contains(target))
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updateCoords();
    window.addEventListener("resize", updateCoords);
    window.addEventListener("scroll", updateCoords, true);
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [open, updateCoords]);

  async function openPanel() {
    const next = !open;
    setOpen(next);
    if (next) {
      updateCoords();
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

  const panel = open && coords && (
    <div
      ref={panelRef}
      style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
      className="z-50 overflow-hidden rounded-xl border border-ink-600 bg-ink-900 shadow-card"
    >
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
  );

  return (
    <div className="relative" ref={wrapperRef}>
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
      {mounted && panel && createPortal(panel, document.body)}
    </div>
  );
}
