import { headers } from "next/headers";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { resolveClientIp } from "@/lib/client-ip";

type LogInput = {
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  severity?: "info" | "warning" | "error" | "critical";
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  isUserVisible?: boolean;
};

export async function logAuditEvent(input: LogInput) {
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    severity: input.severity ?? "info",
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    isUserVisible: input.isUserVisible ?? false,
  });
}

export async function getRequestAuditContext() {
  const headerStore = await headers();
  return getAuditContextFromHeaders(headerStore);
}

export function getAuditContextFromHeaders(headerStore: Headers | null | undefined) {
  return {
    ipAddress: resolveClientIp(headerStore),
    userAgent: headerStore?.get("user-agent") ?? null,
  };
}
