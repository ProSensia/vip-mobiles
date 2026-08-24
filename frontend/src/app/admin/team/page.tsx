"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserCircle, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, FormField, Textarea, Select } from "@/components/ui/Input";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";

interface TeamProfile {
  position: string | null;
  bio: string | null;
  photoUrl: string | null;
  phone: string | null;
  branchId: string | null;
  displayOnSite: boolean;
  sortOrder: number;
}

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  teamProfile: TeamProfile | null;
}

// Distinct from Staff & Roles (accounts, permissions, passwords) — this page
// manages the PUBLIC "About & Team" profile shown on the storefront about
// page: photo, bio, and whether the person appears there at all. It starts
// from the same staff list rather than inventing a separate "team member"
// entity, since every public team profile is still tied to a real staff
// account.
export default function TeamPage() {
  const { data, loading, refetch } = useFetch<{ users: StaffRow[] }>("/users");
  const [editing, setEditing] = useState<StaffRow | null>(null);

  const columns: Column<StaffRow>[] = [
    { key: "name", header: "Staff", render: (u) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-900 text-xs font-bold text-gold-400">
          {u.teamProfile?.photoUrl ? (
            <img src={u.teamProfile.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            u.name.charAt(0)
          )}
        </div>
        <div>
          <p className="font-medium">{u.name}</p>
          <p className="text-xs text-muted">{u.role.replace(/_/g, " ")}</p>
        </div>
      </div>
    ) },
    { key: "position", header: "Public Title", render: (u) => u.teamProfile?.position || "—" },
    {
      key: "display", header: "On About Page",
      render: (u) => u.teamProfile?.displayOnSite ? (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Eye className="h-3.5 w-3.5" /> Shown</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-muted"><EyeOff className="h-3.5 w-3.5" /> Hidden</span>
      ),
    },
    {
      key: "actions", header: "", className: "text-right",
      render: (u) => (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setEditing(u)}><UserCircle className="h-4 w-4" /> Edit Profile</Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="About & Team"
        description="Manage the public photo, title and bio shown on the About page for each staff member."
      />
      <DataTable columns={columns} rows={data?.users.filter((u) => u.isActive) ?? []} loading={loading} emptyTitle="No staff yet" />
      {editing && <TeamProfileModal staff={editing} onClose={() => setEditing(null)} onSaved={refetch} />}
    </div>
  );
}

function TeamProfileModal({ staff, onClose, onSaved }: { staff: StaffRow; onClose: () => void; onSaved: () => void }) {
  const { data: branchesData } = useFetch<{ branches: any[] }>("/branches?all=1");
  const [form, setForm] = useState({
    photoUrl: staff.teamProfile?.photoUrl ?? "",
    position: staff.teamProfile?.position ?? "",
    bio: staff.teamProfile?.bio ?? "",
    phone: staff.teamProfile?.phone ?? "",
    branchId: staff.teamProfile?.branchId ?? "",
    displayOnSite: staff.teamProfile?.displayOnSite ?? false,
    sortOrder: staff.teamProfile?.sortOrder ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await clientApi.put(`/users/${staff.id}/team-profile`, {
        photoUrl: form.photoUrl || null,
        position: form.position || null,
        bio: form.bio || null,
        phone: form.phone || null,
        branchId: form.branchId || null,
        displayOnSite: form.displayOnSite,
        sortOrder: form.sortOrder,
      });
      toast.success("Team profile saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not save team profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await clientApi.delete(`/users/${staff.id}/team-profile`);
      toast.success("Removed from the public team page");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not remove profile");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Team Profile — ${staff.name}`} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Photo">
          <ImageUploader folder="staff" value={form.photoUrl} onChange={(url) => set("photoUrl", url)} aspect="aspect-square" />
        </FormField>
        <FormField label="Public Title" hint='e.g. "Store Manager", "Senior Sales Consultant"'>
          <Input value={form.position} onChange={(e) => set("position", e.target.value)} />
        </FormField>
        <FormField label="Bio (optional)">
          <Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={3} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Phone (optional)"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></FormField>
          <FormField label="Branch (optional)">
            <Select value={form.branchId} onChange={(e) => set("branchId", e.target.value)}>
              <option value="">Not branch-specific</option>
              {(branchesData?.branches ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label="Display Order"><Input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} /></FormField>
        <label className="flex items-center gap-2 text-sm text-cream">
          <input type="checkbox" checked={form.displayOnSite} onChange={(e) => set("displayOnSite", e.target.checked)} className="h-4 w-4 rounded border-ink-600 accent-gold-500" />
          Show on the public About page
        </label>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" loading={saving}>Save Profile</Button>
          {staff.teamProfile && (
            <Button type="button" variant="outline" onClick={handleRemove} loading={removing}>Remove</Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
