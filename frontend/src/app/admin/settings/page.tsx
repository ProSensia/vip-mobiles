"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input, FormField } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { useFetch } from "@/lib/useFetch";
import { clientApi, ClientApiError } from "@/lib/clientApi";

export default function SettingsPage() {
  const { data, loading } = useFetch<{ settings: any }>("/settings");
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  function set(path: string, value: any) {
    setForm((f: any) => {
      const next = { ...f };
      const keys = path.split(".");
      let cursor = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cursor[keys[i]] = { ...cursor[keys[i]] };
        cursor = cursor[keys[i]];
      }
      cursor[keys[keys.length - 1]] = value;
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await clientApi.put("/settings", { settings: form });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) return <p className="text-sm text-muted">Loading settings...</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Store Settings" description="Branding, contact details and SEO defaults for your storefront." action={<Button onClick={handleSave} loading={saving}><Save className="h-4 w-4" /> Save Changes</Button>} />

      <Card>
        <CardHeader title="Branding" />
        <CardBody className="space-y-4">
          <FormField label="Site Logo">
            <ImageUploader folder="settings" value={form.logoUrl} onChange={(url) => set("logoUrl", url)} aspect="aspect-square max-w-[140px]" />
          </FormField>
          <FormField label="Store Name"><Input value={form.siteName ?? ""} onChange={(e) => set("siteName", e.target.value)} /></FormField>
          <FormField label="Tagline"><Input value={form.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} /></FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contact & WhatsApp" />
        <CardBody className="space-y-4">
          <FormField label="WhatsApp Number" hint="Digits only, with country code (e.g. 923001234567) — used for Request to Buy messages.">
            <Input value={form.whatsappNumber ?? ""} onChange={(e) => set("whatsappNumber", e.target.value)} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Contact Email"><Input value={form.contactEmail ?? ""} onChange={(e) => set("contactEmail", e.target.value)} /></FormField>
            <FormField label="Contact Phone"><Input value={form.contactPhone ?? ""} onChange={(e) => set("contactPhone", e.target.value)} /></FormField>
          </div>
          <FormField label="Currency Code"><Input value={form.currency ?? ""} onChange={(e) => set("currency", e.target.value)} placeholder="PKR" /></FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Social Links" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <FormField label="Facebook"><Input value={form.socialLinks?.facebook ?? ""} onChange={(e) => set("socialLinks.facebook", e.target.value)} /></FormField>
          <FormField label="Instagram"><Input value={form.socialLinks?.instagram ?? ""} onChange={(e) => set("socialLinks.instagram", e.target.value)} /></FormField>
          <FormField label="TikTok"><Input value={form.socialLinks?.tiktok ?? ""} onChange={(e) => set("socialLinks.tiktok", e.target.value)} /></FormField>
          <FormField label="YouTube"><Input value={form.socialLinks?.youtube ?? ""} onChange={(e) => set("socialLinks.youtube", e.target.value)} /></FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="SEO Defaults" subtitle="Used when a page doesn't set its own meta title/description." />
        <CardBody className="space-y-4">
          <FormField label="Default Meta Title"><Input value={form.seoDefaults?.metaTitle ?? ""} onChange={(e) => set("seoDefaults.metaTitle", e.target.value)} /></FormField>
          <FormField label="Default Meta Description"><Input value={form.seoDefaults?.metaDescription ?? ""} onChange={(e) => set("seoDefaults.metaDescription", e.target.value)} /></FormField>
        </CardBody>
      </Card>
    </div>
  );
}
