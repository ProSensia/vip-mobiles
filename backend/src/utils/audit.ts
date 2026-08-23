import type { Request } from "express";
import { prisma } from "../lib/prisma";

interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

export async function recordAudit(req: Request, input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        meta: input.meta as any,
        ipAddress: req.ip,
      },
    });
  } catch (err) {
    // Audit logging must never break the primary request flow.
    console.error("Failed to record audit log:", err);
  }
}
