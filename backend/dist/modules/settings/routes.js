"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SETTINGS = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const audit_1 = require("../../utils/audit");
const shared_1 = require("@vip/shared");
const router = (0, express_1.Router)();
exports.DEFAULT_SETTINGS = {
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
const PUBLIC_KEYS = Object.keys(exports.DEFAULT_SETTINGS);
router.get("/", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const rows = await prisma_1.prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
    const map = { ...exports.DEFAULT_SETTINGS };
    for (const row of rows)
        map[row.key] = row.value;
    res.json({ settings: map });
}));
const updateSchema = zod_1.z.object({ settings: zod_1.z.record(zod_1.z.any()) });
router.put("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.SETTINGS_MANAGE), (0, validate_1.validateBody)(updateSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const entries = Object.entries(req.body.settings);
    await prisma_1.prisma.$transaction(entries.map(([key, value]) => prisma_1.prisma.setting.upsert({
        where: { key },
        create: { key, value: value },
        update: { value: value },
    })));
    await (0, audit_1.recordAudit)(req, { action: "settings.updated", entityType: "Setting", meta: { keys: entries.map(([k]) => k) } });
    const rows = await prisma_1.prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
    const map = { ...exports.DEFAULT_SETTINGS };
    for (const row of rows)
        map[row.key] = row.value;
    res.json({ settings: map });
}));
exports.default = router;
