"use client";

import { PageHeader } from "@/components/admin/PageHeader";
import { ScanAndSell } from "@/components/inventory/ScanAndSell";

export default function AdminScanPage() {
  return (
    <div>
      <PageHeader title="Scan & Sell" description="Scan a mobile's QR/barcode or IMEI to sell it in seconds." />
      <ScanAndSell />
    </div>
  );
}
