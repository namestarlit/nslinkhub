import type { AuditAction } from "@nslinkhub/types";
import type { Prisma } from "../generated/prisma/client";

export interface AuditInput {
  hubId: string;
  actorUserId: string;
  collectionId?: string;
  targetUserId?: string;
  action: AuditAction;
  role?: "reader" | "editor";
}

// Called only inside the same transaction as the protected mutation. There is
// no free-form payload: names, emails, tokens and authored content stay out.
export function recordAudit(tx: Prisma.TransactionClient, input: AuditInput) {
  return tx.auditRecord.create({ data: input });
}
