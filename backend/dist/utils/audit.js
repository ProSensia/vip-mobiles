"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAudit = recordAudit;
const prisma_1 = require("../lib/prisma");
async function recordAudit(req, input) {
    try {
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: req.user?.id,
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId,
                meta: input.meta,
                ipAddress: req.ip,
            },
        });
    }
    catch (err) {
        // Audit logging must never break the primary request flow.
        console.error("Failed to record audit log:", err);
    }
}
