"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Clock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { formatCurrency } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "CLOSED", label: "Closed" },
];

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

interface AuditRow {
  id: string;
  action: string;
  createdAt: string;
  user: { id: string; name: string } | null;
  meta: Record<string, any> | null;
}

function describeEvent(row: AuditRow): string {
  const who = row.user?.name ?? "System";
  const meta = row.meta ?? {};
  switch (row.action) {
    case "buyRequest.referred":
      return `${who} referred this to ${meta.toUserName ?? "a team member"}${meta.note ? ` — "${meta.note}"` : ""}`;
    case "buyRequest.statusChanged":
      return `${who} changed status from ${String(meta.previousStatus ?? "").toLowerCase()} to ${String(meta.newStatus ?? "").toLowerCase()}`;
    default:
      return `${who} — ${row.action.replace(/\./g, " ")}`;
  }
}

export function BuyRequestDetailModal({
  requestId,
  canRefer,
  onClose,
  onChanged,
}: {
  requestId: string;
  canRefer: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, loading, refetch } = useFetch<{ buyRequest: any; history: AuditRow[] }>(`/buy-requests/${requestId}`, [requestId]);
  const { data: usersData } = useFetch<{ users: any[] }>(canRefer ? "/users" : null);
  const [referring, setReferring] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const request = data?.buyRequest;
  const history = data?.history ?? [];

  const eligibleUsers = (usersData?.users ?? []).filter(
    (u: any) => u.isActive && u.role !== "CONTENT_MANAGER" && u.id !== request?.assignedTo?.id
  );

  async function updateStatus(status: string) {
    try {
      await clientApi.patch(`/buy-requests/${requestId}`, { status });
      refetch();
      onChanged();
      toast.success("Status updated");
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not update status");
    }
  }

  async function submitRefer() {
    if (!targetUserId) {
      toast.error("Select a team member to refer this to");
      return;
    }
    setSubmitting(true);
    try {
      await clientApi.post(`/buy-requests/${requestId}/refer`, { toUserId: targetUserId, note: note || undefined });
      toast.success("Request referred");
      setReferring(false);
      setNote("");
      setTargetUserId("");
      refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not refer this request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Buy Request" className="max-w-xl">
      {loading || !request ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="font-display text-base font-semibold text-cream">{request.product.title}</p>
            <p className="mt-1 text-sm text-muted">
              {formatCurrency(request.product.basePrice)}
              {request.offeredPrice ? ` · Offered ${formatCurrency(request.offeredPrice)}` : ""}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted">Customer</p>
              <p className="text-cream">{request.customerName}</p>
              <p className="text-xs text-muted">{request.contact}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Assigned To</p>
              <p className="text-cream">{request.assignedTo?.name ?? "Unassigned"}</p>
            </div>
          </div>

          {request.message && (
            <div>
              <p className="text-xs text-muted">Message</p>
              <p className="text-sm text-cream/90">{request.message}</p>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs text-muted">Status</p>
            <Select value={request.status} onChange={(e) => updateStatus(e.target.value)} className="w-full">
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>

          {canRefer && (
            <div className="rounded-xl border border-ink-600 p-3">
              {!referring ? (
                <Button variant="outline" size="sm" onClick={() => setReferring(true)}>
                  <UserPlus className="h-4 w-4" /> Refer / Assign
                </Button>
              ) : (
                <div className="space-y-2">
                  <Select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
                    <option value="">Select a team member...</option>
                    {eligibleUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name} — {u.role.replace(/_/g, " ")}</option>
                    ))}
                  </Select>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder='Optional note (e.g. "Please contact this customer regarding the requested iPhone.")'
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={submitRefer} loading={submitting}>Assign</Button>
                    <Button size="sm" variant="ghost" onClick={() => setReferring(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-cream">
              <Clock className="h-3.5 w-3.5" /> Activity Timeline
            </p>
            {history.length === 0 ? (
              <p className="text-xs text-muted">No activity yet.</p>
            ) : (
              <div className="space-y-2.5 border-l border-ink-600 pl-3">
                {history.map((row) => (
                  <div key={row.id} className="text-xs">
                    <p className="text-cream/90">{describeEvent(row)}</p>
                    <p className="text-muted">{formatDateTime(row.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
