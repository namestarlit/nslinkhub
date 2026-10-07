import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { webServerConfig } from "@nslinkhub/config/web-server";
import { cookies } from "next/headers";
import { serverCookie } from "./cookies";
import type { ApiPath } from "./http";

// An action that needs a fresh email code (sensitive operator actions). It is
// kept, encrypted, while the person confirms it's them, then replayed once with
// the same operation id, so it can't double-apply.
export interface PendingAction {
  path: ApiPath;
  body: Record<string, unknown>;
  /** Where to return afterwards (the page the action was taken from). */
  target: string;
  /** What the action does, for "Confirm it's you to …". */
  label: string;
  issued: number;
}

const ttl = 15 * 60;
const name = "pending_action";
const key = () =>
  createHash("sha256").update(`web-pending-action:${webServerConfig().sourceSecret}`).digest();

export function pendingActionCookie(action: PendingAction | null) {
  if (!action) return serverCookie(name, "", 0);
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const sealed = Buffer.concat([
    iv,
    cipher.update(JSON.stringify(action)),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64url");
  return serverCookie(name, sealed, ttl);
}

export async function readPendingAction(now = Date.now()): Promise<PendingAction | null> {
  try {
    const raw = (await cookies()).get(name)?.value;
    if (!raw || raw.length > 4000) return null;
    const bytes = Buffer.from(raw, "base64url"),
      decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(-16));
    const action = JSON.parse(
      Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString(),
    ) as PendingAction;
    if (
      typeof action.path !== "string" ||
      !action.path.startsWith("/api/v1/operations/") ||
      typeof action.target !== "string" ||
      !action.target.startsWith("/ops") ||
      typeof action.label !== "string" ||
      !Number.isFinite(action.issued) ||
      action.issued > now ||
      now - action.issued > ttl * 1000
    )
      return null;
    return action;
  } catch {
    return null;
  }
}
