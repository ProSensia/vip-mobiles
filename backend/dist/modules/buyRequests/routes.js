"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const audit_1 = require("../../utils/audit");
const notifications_1 = require("../../utils/notifications");
const shared_1 = require("../../shared");
const router = (0, express_1.Router)();
const createSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1),
    variantLabel: zod_1.z.string().max(120).optional().nullable(),
    customerName: zod_1.z.string().min(2).max(150),
    contact: zod_1.z.string().min(3).max(150),
    offeredPrice: zod_1.z.coerce.number().positive().optional().nullable(),
    message: zod_1.z.string().max(1000).optional().nullable(),
});
// Public: logged by the store even though the actual conversation happens over
// WhatsApp — this keeps a record admins can follow up on from the dashboard.
router.post("/", rateLimit_1.publicFormLimiter, (0, validate_1.validateBody)(createSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const product = await prisma_1.prisma.product.findUnique({ where: { id: req.body.productId }, select: { id: true, title: true } });
    if (!product)
        throw new errorHandler_1.ApiError(404, "Product not found");
    const buyRequest = await prisma_1.prisma.buyRequest.create({ data: req.body });
    (0, notifications_1.notifyUsersWithPermission)(shared_1.PERMISSIONS.BUY_REQUESTS_VIEW, {
        type: "BUY_REQUEST_NEW",
        title: "New Buy Request",
        message: `${req.body.customerName} is interested in ${product.title}`,
        link: `/admin/buy-requests?id=${buyRequest.id}`,
    });
    res.status(201).json({ buyRequest: { id: buyRequest.id } });
}));
router.use(auth_1.authenticate);
// Non-managers only see requests that are unassigned or assigned to them —
// managers/admins (buyRequests.manage) see everything. This is what "a
// salesman should see their assigned requests and anything their role
// permits" maps to: no separate "view all" permission needed, it's just
// what buyRequests.manage already implies.
function canManageAll(req) {
    return (0, shared_1.hasPermission)({ role: req.user.role, permissions: req.user.permissions }, shared_1.PERMISSIONS.BUY_REQUESTS_MANAGE);
}
router.get("/", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.BUY_REQUESTS_VIEW), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const status = req.query.status;
    const where = { ...(status ? { status } : {}) };
    if (!canManageAll(req)) {
        where.OR = [{ assignedToId: null }, { assignedToId: req.user.id }];
    }
    const requests = await prisma_1.prisma.buyRequest.findMany({
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
}));
router.get("/:id", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.BUY_REQUESTS_VIEW), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const buyRequest = await prisma_1.prisma.buyRequest.findUnique({
        where: { id: req.params.id },
        include: {
            product: { select: { id: true, title: true, slug: true, basePrice: true } },
            assignedTo: { select: { id: true, name: true, role: true } },
            handledBy: { select: { id: true, name: true } },
        },
    });
    if (!buyRequest)
        throw new errorHandler_1.ApiError(404, "Buy request not found");
    if (!canManageAll(req) && buyRequest.assignedToId && buyRequest.assignedToId !== req.user.id) {
        throw new errorHandler_1.ApiError(403, "This request is assigned to another team member");
    }
    const historyRows = await prisma_1.prisma.auditLog.findMany({
        where: { entityType: "BuyRequest", entityId: buyRequest.id },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
    });
    // Referral entries reference other users by id inside `meta`
    // (fromUserId/toUserId) — resolve those to names here so the frontend
    // timeline doesn't need a second round trip or its own user lookup.
    const referencedIds = new Set();
    for (const row of historyRows) {
        const meta = row.meta;
        if (meta?.fromUserId && typeof meta.fromUserId === "string")
            referencedIds.add(meta.fromUserId);
        if (meta?.toUserId && typeof meta.toUserId === "string")
            referencedIds.add(meta.toUserId);
    }
    const referencedUsers = referencedIds.size
        ? await prisma_1.prisma.user.findMany({ where: { id: { in: Array.from(referencedIds) } }, select: { id: true, name: true } })
        : [];
    const nameById = new Map(referencedUsers.map((u) => [u.id, u.name]));
    const history = historyRows.map((row) => {
        const meta = row.meta;
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
}));
const STATUS_VALUES = ["NEW", "ASSIGNED", "CONTACTED", "ACCEPTED", "REJECTED", "CANCELLED", "CLOSED"];
const updateSchema = zod_1.z.object({ status: zod_1.z.enum(STATUS_VALUES) });
router.patch("/:id", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.BUY_REQUESTS_VIEW), (0, validate_1.validateBody)(updateSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const existing = await prisma_1.prisma.buyRequest.findUnique({
        where: { id: req.params.id },
        include: { product: { select: { title: true } } },
    });
    if (!existing)
        throw new errorHandler_1.ApiError(404, "Buy request not found");
    // A user with only buyRequests.view can still move the status forward on
    // a request assigned specifically to them ("manage assigned requests");
    // anyone with buyRequests.manage can update any request.
    const isAssignee = existing.assignedToId === req.user.id;
    if (!canManageAll(req) && !isAssignee) {
        throw new errorHandler_1.ApiError(403, "You can only update requests assigned to you");
    }
    const buyRequest = await prisma_1.prisma.buyRequest.update({
        where: { id: req.params.id },
        data: { status: req.body.status, handledById: req.user.id },
    });
    (0, audit_1.recordAudit)(req, {
        action: "buyRequest.statusChanged",
        entityType: "BuyRequest",
        entityId: buyRequest.id,
        meta: { previousStatus: existing.status, newStatus: buyRequest.status },
    });
    const statusLabel = req.body.status.charAt(0) + req.body.status.slice(1).toLowerCase();
    if (existing.assignedToId && existing.assignedToId !== req.user.id) {
        (0, notifications_1.notifyUser)({
            userId: existing.assignedToId,
            type: "BUY_REQUEST_STATUS_CHANGED",
            title: "Buy Request Updated",
            message: `${existing.product.title} — status changed to ${statusLabel}`,
            link: `/admin/buy-requests?id=${buyRequest.id}`,
        });
    }
    (0, notifications_1.notifyUsersWithPermission)(shared_1.PERMISSIONS.BUY_REQUESTS_MANAGE, {
        type: "BUY_REQUEST_STATUS_CHANGED",
        title: "Buy Request Updated",
        message: `${existing.product.title} — status changed to ${statusLabel}`,
        link: `/admin/buy-requests?id=${buyRequest.id}`,
    }, req.user.id);
    res.json({ buyRequest });
}));
const referSchema = zod_1.z.object({
    toUserId: zod_1.z.string().min(1),
    note: zod_1.z.string().max(300).optional(),
});
router.post("/:id/refer", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.BUY_REQUESTS_REFER), (0, validate_1.validateBody)(referSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const existing = await prisma_1.prisma.buyRequest.findUnique({
        where: { id: req.params.id },
        include: { product: { select: { title: true } } },
    });
    if (!existing)
        throw new errorHandler_1.ApiError(404, "Buy request not found");
    const target = await prisma_1.prisma.user.findUnique({ where: { id: req.body.toUserId } });
    if (!target || !target.isActive)
        throw new errorHandler_1.ApiError(400, "Selected team member is not available");
    if (!(0, shared_1.hasPermission)({ role: target.role, permissions: target.permissions }, shared_1.PERMISSIONS.BUY_REQUESTS_VIEW)) {
        throw new errorHandler_1.ApiError(400, "Selected team member cannot handle buy requests");
    }
    const previousAssigneeId = existing.assignedToId;
    const newStatus = existing.status === "NEW" ? "ASSIGNED" : existing.status;
    const buyRequest = await prisma_1.prisma.buyRequest.update({
        where: { id: req.params.id },
        data: { assignedToId: target.id, status: newStatus },
    });
    (0, audit_1.recordAudit)(req, {
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
    (0, notifications_1.notifyUser)({
        userId: target.id,
        type: "BUY_REQUEST_REFERRED",
        title: "New Buy Request Assigned",
        message: `A customer request for ${existing.product.title} has been assigned to you${req.body.note ? ` — "${req.body.note}"` : ""}`,
        link: `/admin/buy-requests?id=${buyRequest.id}`,
    });
    if (previousAssigneeId && previousAssigneeId !== target.id && previousAssigneeId !== req.user.id) {
        (0, notifications_1.notifyUser)({
            userId: previousAssigneeId,
            type: "BUY_REQUEST_REFERRED",
            title: "Buy Request Reassigned",
            message: `${existing.product.title} has been reassigned to ${target.name}`,
            link: `/admin/buy-requests?id=${buyRequest.id}`,
        });
    }
    res.json({ buyRequest });
}));
exports.default = router;
