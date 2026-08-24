import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { recordAudit } from "../../utils/audit";
import { PERMISSIONS } from "../../shared";

const router = Router();

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  siteName: "VIP Mobiles",
  tagline: "Smart Phones • Accessories • Services",
  logoUrl: null,
  whatsappNumber: "",
  currency: "PKR",
  contactEmail: "",
  contactPhone: "",
  socialLinks: { facebook: "", instagram: "", tiktok: "", youtube: "" },
  seoDefaults: {
    metaTitle: "VIP Mobiles – Premium Smart Phones, Accessories & Services",
    metaDescription: "Shop new, used and refurbished smartphones with genuine warranty and trusted service.",
    ogImage: null,
  },
};

// Public settings are the only ones the storefront needs; anything else
// (feature flags, internal toggles) should be namespaced separately so it's
// never accidentally exposed here.
const PUBLIC_KEYS = Object.keys(DEFAULT_SETTINGS);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
    const map: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const row of rows) map[row.key] = row.value;
    res.json({ settings: map });
  })
);

const updateSchema = z.object({ settings: z.record(z.any()) });

router.put(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const entries = Object.entries(req.body.settings) as [string, unknown][];
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          create: { key, value: value as any },
          update: { value: value as any },
        })
      )
    );
    recordAudit(req, { action: "settings.updated", entityType: "Setting", meta: { keys: entries.map(([k]) => k) } });

    const rows = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
    const map: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const row of rows) map[row.key] = row.value;
    res.json({ settings: map });
  })
);

export default router;
