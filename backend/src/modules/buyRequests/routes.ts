import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { publicFormLimiter } from "../../middleware/rateLimit";
import { recordAudit } from "../../utils/audit";
import { notifyUser, notifyUsersWithPermission } from "../../utils/notifications";
import { PERMISSIONS, hasPermission } from "../../shared";

const router = Router();

const createSchema = z.object({
  productId: z.string().min(1),
  variantLabel: z.string().max(120).optional().nullable(),
  customerName: z.string().min(2).max(150),
  contact: z.string().min(3).max(150),
  offeredPrice: z.coerce.number().positive().optional().nullable(),
  message: z.string().max(1000).optional().nullable(),
});

// Public: logged by the store even though the actual conversation happens over
// WhatsApp — this keeps a record admins can follow up on from the dashboard.
router.post(
  "/",
  publicFormLimiter,
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.body.productId }, select: { id: true, title: true } });
    if (!product) throw new ApiError(404, "Product not found");

    const buyRequest = await prisma.buyRequest.create({ data: req.body });

    notifyUsersWithPermission(PERMISSIONS.BUY_REQUESTS_VIEW, {
      type: "BUY_REQUEST_NEW",
      title: "New Buy Request",
      message: `${req.body.customerName} is interested in ${product.title}`,
      link: `/admin/buy-requests?id=${buyRequest.id}`,
    });

    res.status(201).json({ buyRequest: { id: buyRequest.id } });
  })
);

router.use(authenticate);

// Non-managers only see requests that are unassigned or assigned to them —
// managers/admins (buyRequests.manage) see everything. This is what "a
// salesman should see their assigned requests and anything their role
// permits" maps to: no separate "view all" permission needed, it's just
// what buyRequests.manage already implies.
function canManageAll(req: import("express").Request): boolean {
  return hasPermission({ role: req.user!.role, permissions: req.user!.permissions as any }, PERMISSIONS.BUY_REQUESTS_MANAGE);
}

router.get(
  "/",
  requirePermission(PERMISSIONS.BUY_REQUESTS_VIEW),
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const where: any = { ...(status ? { status } : {}) };
    if (!canManageAll(req)) {
      where.OR = [{ assignedToId: null }, { assignedToId: req.user!.id }];
    }

    const requests = await prisma.buyRequest.findMany({
      where,
      include: {
        product: { select: { id: true, title: true, slug: true, basePrice: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
        handledBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ requests });
  })
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.BUY_REQUESTS_VIEW),
  asyncHandler(async (req, res) => {
    const buyRequest = await prisma.buyRequest.findUnique({
      where: { id: req.params.id },
      include: {
        product: { select: { id: true, title: true, slug: true, basePrice: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
        handledBy: { select: { id: true, name: true } },
      },
    });
    if (!buyRequest) throw new ApiError(404, "Buy request not found");
    if (!canManageAll(req) && buyRequest.assignedToId && buyRequest.assignedToId !== req.user!.id) {
      throw new ApiError(403, "This request is assigned to another team member");
    }

    const historyRows = await prisma.auditLog.findMany({
      where: { entityType: "BuyRequest", entityId: buyRequest.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    // Referral entries reference other users by id inside `meta`
    // (fromUserId/toUserId) — resolve those to names here so the frontend
    // timeline doesn't need a second round trip or its own user lookup.
    const referencedIds = new Set<string>();
    for (const row of historyRows) {
      const meta = row.meta as Record<string, unknown> | null;
      if (meta?.fromUserId && typeof meta.fromUserId === "string") referencedIds.add(meta.fromUserId);
      if (meta?.toUserId && typeof meta.toUserId === "string") referencedIds.add(meta.toUserId);
    }
    const referencedUsers = referencedIds.size
      ? await prisma.user.findMany({ where: { id: { in: Array.from(referencedIds) } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(referencedUsers.map((u) => [u.id, u.name]));

    const history = historyRows.map((row) => {
      const meta = row.meta as Record<string, unknown> | null;
      return {
        ...row,
        meta: meta
          ? {
              ...meta,
              fromUserName: typeof meta.fromUserId === "string" ? nameById.get(meta.fromUserId) ?? null : undefined,
              toUserName: typeof meta.toUserId === "string" ? nameById.get(meta.toUserId) ?? null : undefined,
            }
          : meta,
      };
    });

    res.json({ buyRequest, history });
  })
);

const STATUS_VALUES = ["NEW", "ASSIGNED", "CONTACTED", "ACCEPTED", "REJECTED", "CANCELLED", "CLOSED"] as const;
const updateSchema = z.object({ status: z.enum(STATUS_VALUES) });

router.patch(
  "/:id",
  requirePermission(PERMISSIONS.BUY_REQUESTS_VIEW),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.buyRequest.findUnique({
      where: { id: req.params.id },
      include: { product: { select: { title: true } } },
    });
    if (!existing) throw new ApiError(404, "Buy request not found");

    // A user with only buyRequests.view can still move the status forward on
    // a request assigned specifically to them ("manage assigned requests");
    // anyone with buyRequests.manage can update any request.
    const isAssignee = existing.assignedToId === req.user!.id;
    if (!canManageAll(req) && !isAssignee) {
      throw new ApiError(403, "You can only update requests assigned to you");
    }

    const buyRequest = await prisma.buyRequest.update({
      where: { id: req.params.id },
      data: { status: req.body.status, handledById: req.user!.id },
    });

    recordAudit(req, {
      action: "buyRequest.statusChanged",
      entityType: "BuyRequest",
      entityId: buyRequest.id,
      meta: { previousStatus: existing.status, newStatus: buyRequest.status },
    });

    const statusLabel = req.body.status.charAt(0) + req.body.status.slice(1).toLowerCase();
    if (existing.assignedToId && existing.assignedToId !== req.user!.id) {
      notifyUser({
        userId: existing.assignedToId,
        type: "BUY_REQUEST_STATUS_CHANGED",
        title: "Buy Request Updated",
        message: `${existing.product.title} — status changed to ${statusLabel}`,
        link: `/admin/buy-requests?id=${buyRequest.id}`,
      });
    }
    notifyUsersWithPermission(
      PERMISSIONS.BUY_REQUESTS_MANAGE,
      {
        type: "BUY_REQUEST_STATUS_CHANGED",
        title: "Buy Request Updated",
        message: `${existing.product.title} — status changed to ${statusLabel}`,
        link: `/admin/buy-requests?id=${buyRequest.id}`,
      },
      req.user!.id
    );

    res.json({ buyRequest });
  })
);

const referSchema = z.object({
  toUserId: z.string().min(1),
  note: z.string().max(300).optional(),
});

router.post(
  "/:id/refer",
  requirePermission(PERMISSIONS.BUY_REQUESTS_REFER),
  validateBody(referSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.buyRequest.findUnique({
      where: { id: req.params.id },
      include: { product: { select: { title: true } } },
    });
    if (!existing) throw new ApiError(404, "Buy request not found");

    const target = await prisma.user.findUnique({ where: { id: req.body.toUserId } });
    if (!target || !target.isActive) throw new ApiError(400, "Selected team member is not available");
    if (!hasPermission({ role: target.role, permissions: target.permissions as any }, PERMISSIONS.BUY_REQUESTS_VIEW)) {
      throw new ApiError(400, "Selected team member cannot handle buy requests");
    }

    const previousAssigneeId = existing.assignedToId;
    const newStatus = existing.status === "NEW" ? "ASSIGNED" : existing.status;

    const buyRequest = await prisma.buyRequest.update({
      where: { id: req.params.id },
      data: { assignedToId: target.id, status: newStatus },
    });

    recordAudit(req, {
      action: "buyRequest.referred",
      entityType: "BuyRequest",
      entityId: buyRequest.id,
      meta: {
        fromUserId: previousAssigneeId,
        toUserId: target.id,
        note: req.body.note ?? null,
        previousStatus: existing.status,
        newStatus,
      },
    });

    notifyUser({
      userId: target.id,
      type: "BUY_REQUEST_REFERRED",
      title: "New Buy Request Assigned",
      message: `A customer request for ${existing.product.title} has been assigned to you${req.body.note ? ` — "${req.body.note}"` : ""}`,
      link: `/admin/buy-requests?id=${buyRequest.id}`,
    });

    if (previousAssigneeId && previousAssigneeId !== target.id && previousAssigneeId !== req.user!.id) {
      notifyUser({
        userId: previousAssigneeId,
        type: "BUY_REQUEST_REFERRED",
        title: "Buy Request Reassigned",
        message: `${existing.product.title} has been reassigned to ${target.name}`,
        link: `/admin/buy-requests?id=${buyRequest.id}`,
      });
    }

    res.json({ buyRequest });
  })
);

export default router;
