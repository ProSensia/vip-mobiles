"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const password_1 = require("../../utils/password");
const audit_1 = require("../../utils/audit");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireSuperAdmin);
router.get("/demo-data-summary", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const [products, brands, categories, colors, branches, users, sales, reviews] = await Promise.all([
        prisma_1.prisma.product.count({ where: { isDemo: true } }),
        prisma_1.prisma.brand.count({ where: { isDemo: true } }),
        prisma_1.prisma.category.count({ where: { isDemo: true } }),
        prisma_1.prisma.color.count({ where: { isDemo: true } }),
        prisma_1.prisma.branch.count({ where: { isDemo: true } }),
        prisma_1.prisma.user.count({ where: { isDemo: true } }),
        prisma_1.prisma.sale.count({ where: { isDemo: true } }),
        prisma_1.prisma.review.count({ where: { isDemo: true } }),
    ]);
    res.json({ products, brands, categories, colors, branches, users, sales, reviews });
}));
const confirmSchema = zod_1.z.object({
    password: zod_1.z.string().min(1),
    confirmText: zod_1.z.literal("RESET DEMO DATA"),
});
// Destructive, Super-Admin-only "go live" action: wipes everything flagged
// isDemo=true (seeded catalog/branches/staff/sales) while preserving the
// Super Admin account and any real content already entered. Requires the
// caller's current password plus a typed confirmation phrase.
router.post("/reset-demo-data", (0, validate_1.validateBody)(confirmSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = await prisma_1.prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    const valid = await (0, password_1.verifyPassword)(req.body.password, user.passwordHash);
    if (!valid)
        throw new errorHandler_1.ApiError(400, "Incorrect password");
    const summary = {};
    summary.sales = (await prisma_1.prisma.sale.deleteMany({ where: { isDemo: true } })).count;
    summary.reviews = (await prisma_1.prisma.review.deleteMany({ where: { isDemo: true } })).count;
    summary.products = (await prisma_1.prisma.product.deleteMany({ where: { isDemo: true } })).count;
    for (const model of ["brand", "category", "color", "branch", "user"]) {
        try {
            // @ts-expect-error dynamic model access
            summary[model] = (await prisma_1.prisma[model].deleteMany({ where: { isDemo: true } })).count;
        }
        catch {
            summary[model] = -1; // signals "skipped, still referenced by real data"
        }
    }
    await (0, audit_1.recordAudit)(req, { action: "system.demoData.reset", entityType: "System", meta: summary });
    res.json({ ok: true, summary });
}));
exports.default = router;
