import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requireSuperAdmin } from "../../middleware/auth";
import { verifyPassword } from "../../utils/password";
import { recordAudit } from "../../utils/audit";

const router = Router();
router.use(authenticate, requireSuperAdmin);

router.get(
  "/demo-data-summary",
  asyncHandler(async (_req, res) => {
    const [products, brands, categories, colors, branches, users, sales, reviews] = await Promise.all([
      prisma.product.count({ where: { isDemo: true } }),
      prisma.brand.count({ where: { isDemo: true } }),
      prisma.category.count({ where: { isDemo: true } }),
      prisma.color.count({ where: { isDemo: true } }),
      prisma.branch.count({ where: { isDemo: true } }),
      prisma.user.count({ where: { isDemo: true } }),
      prisma.sale.count({ where: { isDemo: true } }),
      prisma.review.count({ where: { isDemo: true } }),
    ]);
    res.json({ products, brands, categories, colors, branches, users, sales, reviews });
  })
);

const confirmSchema = z.object({
  password: z.string().min(1),
  confirmText: z.literal("RESET DEMO DATA"),
});

// Destructive, Super-Admin-only "go live" action: wipes everything flagged
// isDemo=true (seeded catalog/branches/staff/sales) while preserving the
// Super Admin account and any real content already entered. Requires the
// caller's current password plus a typed confirmation phrase.
router.post(
  "/reset-demo-data",
  validateBody(confirmSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const valid = await verifyPassword(req.body.password, user.passwordHash);
    if (!valid) throw new ApiError(400, "Incorrect password");

    const summary: Record<string, number> = {};

    summary.sales = (await prisma.sale.deleteMany({ where: { isDemo: true } })).count;
    summary.reviews = (await prisma.review.deleteMany({ where: { isDemo: true } })).count;
    summary.products = (await prisma.product.deleteMany({ where: { isDemo: true } })).count;

    for (const model of ["brand", "category", "color", "branch", "user"] as const) {
      try {
        // @ts-expect-error dynamic model access
        summary[model] = (await prisma[model].deleteMany({ where: { isDemo: true } })).count;
      } catch {
        summary[model] = -1; // signals "skipped, still referenced by real data"
      }
    }

    recordAudit(req, { action: "system.demoData.reset", entityType: "System", meta: summary });
    res.json({ ok: true, summary });
  })
);

export default router;
