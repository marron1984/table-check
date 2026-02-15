import { prisma } from "./prisma";

export async function logAudit(params: {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      detail: params.detail ? JSON.stringify(params.detail) : null,
      ipAddress: params.ipAddress,
    },
  });
}
