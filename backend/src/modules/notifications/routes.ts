import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticate } from "../../middleware/auth";

const router = Router();
router.use(authenticate);

// Every route here is implicitly scoped to req.user!.id — there is no way
// to pass another user's id in, by design: this is a personal inbox, not a
// generally-queryable resource, so there's nothing to gate behind a
// permission beyond just being logged in.

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listSchema.parse(req.query);
    const where = { userId: req.user!.id };
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.notification.count({ where }),
    ]);
    res.json({ items, total, page: q.page, totalPages: Math.ceil(total / q.limit) });
  })
);

// Polled from the notification bell every ~60s — kept as cheap as possible
// (a single indexed count, no rows fetched) since this is the one endpoint
// that runs on a timer rather than on user action.
router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const count = await prisma.notification.count({ where: { userId: req.user!.id, isRead: false } });
    res.json({ count });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: { isRead: true },
    });
    res.json({ ok: true });
  })
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  })
);

const prefsSchema = z.object({ prefs: z.record(z.boolean()) });

router.put(
  "/preferences",
  asyncHandler(async (req, res) => {
    const body = prefsSchema.parse(req.body);
    await prisma.user.update({ where: { id: req.user!.id }, data: { notificationPrefs: body.prefs } });
    res.json({ ok: true });
  })
);

export default router;
