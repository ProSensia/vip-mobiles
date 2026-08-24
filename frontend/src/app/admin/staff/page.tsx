"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShieldCheck, Copy, Check } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, FormField, Select } from "@/components/ui/Input";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";
import { formatDate } from "@/lib/utils";

const ROLES = ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "SALES_STAFF", "CONTENT_MANAGER"];

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isDemo: boolean;
  branch?: { id: string; name: string } | null;
  lastLoginAt?: string | null;
}

export default function StaffPage() {
  const { data, loading, refetch } = useFetch<{ users: StaffUser[] }>("/users");
  const { data: branchesData } = useFetch<{ branches: any[] }>("/branches?all=1");
  const { confirm, dialog } = useConfirmDialog();
  const [editing, setEditing] = useState<StaffUser | null | "new">(null);

  async function handleDeactivate(user: StaffUser) {
    try {
      await clientApi.patch(`/users/${user.id}`, { isActive: !user.isActive });
      toast.success(user.isActive ? "Staff account deactivated" : "Staff account activated");
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not update account");
    }
  }

  async function handleDelete(user: StaffUser) {
    const ok = await confirm({ title: "Delete Staff Account", description: `Permanently delete ${user.name}'s account?`, destructive: true, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await clientApi.delete(`/users/${user.id}`);
      toast.success("Account deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not delete account");
    }
  }

  const columns: Column<StaffUser>[] = [
    { key: "name", header: "Name", render: (u) => (
      <div>
        <p className="font-medium">{u.name} {u.isDemo && <Badge tone="gray" className="ml-1">Demo</Badge>}</p>
        <p className="text-xs text-muted">{u.email}</p>
      </div>
    ) },
    { key: "role", header: "Role", render: (u) => <Badge tone="gold">{u.role.replace(/_/g, " ")}</Badge> },
    { key: "branch", header: "Branch", render: (u) => u.branch?.name || "—" },
    { key: "status", header: "Status", render: (u) => <Badge tone={u.isActive ? "green" : "red"}>{u.isActive ? "Active" : "Inactive"}</Badge> },
    { key: "lastLogin", header: "Last Login", render: (u) => (u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never") },
    {
      key: "actions", header: "", className: "text-right",
      render: (u) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(u)}><Pencil className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => handleDeactivate(u)}><ShieldCheck className="h-4 w-4 text-amber-400" /></Button>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(u)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Staff & Roles"
        description="Invite staff, assign roles and control what each person can do."
        action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add Staff</Button>}
      />
      <DataTable columns={columns} rows={data?.users ?? []} loading={loading} emptyTitle="No staff accounts yet" />
      {editing && (
        <StaffFormModal
          user={editing === "new" ? null : editing}
          branches={branchesData?.branches ?? []}
          onClose={() => setEditing(null)}
          onSaved={refetch}
        />
      )}
      {dialog}
    </div>
  );
}

function StaffFormModal({ user, branches, onClose, onSaved }: { user: StaffUser | null; branches: any[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState(user?.role ?? "SALES_STAFF");
  const [branchId, setBranchId] = useState(user?.branch?.id ?? "");
  const [position, setPosition] = useState("");
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (user) {
        await clientApi.patch(`/users/${user.id}`, { name, role, branchId: branchId || null });
        toast.success("Staff account updated");
        onSaved();
        onClose();
      } else {
        const res = await clientApi.post<{ tempPassword: string }>("/users", { name, email, role, branchId: branchId || undefined, position: position || undefined });
        toast.success("Staff account created");
        onSaved();
        // Show the temp password once instead of closing immediately — a
        // setup link was also emailed, but this is the fallback if that
        // doesn't arrive (mail delivery on this host has been unreliable).
        setTempPassword(res.tempPassword);
      }
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not save staff account");
    } finally {
      setSaving(false);
    }
  }

  if (tempPassword) {
    return (
      <Modal open onClose={onClose} title="Staff Account Created">
        <TempPasswordReveal name={name} email={email} tempPassword={tempPassword} onDone={onClose} />
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={user ? "Edit Staff" : "Add Staff"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Full Name"><Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></FormField>
        <FormField label="Email" hint={user ? undefined : "An invite link will be emailed to this address."}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!!user} />
        </FormField>
        <FormField label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
          </Select>
        </FormField>
        <FormField label="Branch (optional)">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">No branch assigned</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </FormField>
        {!user && (
          <FormField label="Position (optional)"><Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Sales Executive" /></FormField>
        )}
        <Button type="submit" className="w-full" loading={saving}>{user ? "Save Changes" : "Send Invite"}</Button>
      </form>
    </Modal>
  );
}

function TempPasswordReveal({ name, email, tempPassword, onDone }: { name: string; email: string; tempPassword: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-cream/90">
        A setup link was emailed to <span className="font-medium text-cream">{email}</span>. If it doesn&apos;t arrive, share this temporary password with {name} directly — it will only be shown once here.
      </p>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-gold-500/40 bg-ink-800 px-4 py-3">
        <code className="font-mono text-lg tracking-wide text-gold-400">{tempPassword}</code>
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-muted">They&apos;ll be required to set a new password the first time they sign in.</p>
      <Button className="w-full" onClick={onDone}>Done</Button>
    </div>
  );
}
