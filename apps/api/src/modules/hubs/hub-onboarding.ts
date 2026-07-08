// Framework-free hub bootstrap. Kept importable with a relative path to the
// generated client so the standalone better-auth instance (src/auth/auth.ts,
// loaded by the better-auth CLI, which cannot resolve the `src/*` alias) can
// call it from its user-create hook. This is the single onboarding entry
// point — any auth path (local sign-up today, SSO later) funnels through it.
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";
import { isReservedHandle } from "./handle";

type HubCapableClient = Pick<PrismaClient, "hub">;

export interface PersonalHubParams {
  userId: string;
  name: string;
  email: string;
}

// Slugify a seed into the handle charset: lowercase, [a-z0-9-], single hyphens,
// no leading/trailing hyphen. Falls back to "hub" when nothing usable remains.
function slugifyHandle(seed: string): string {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base.length >= 3 ? base : "hub";
}

// Create the user's one personal hub with a unique, derived handle. The handle
// is the mutable public identity; the immutable hub id is the durable key.
// Retries with a numeric suffix until the unique handle constraint is satisfied.
export async function createPersonalHub(prisma: HubCapableClient, params: PersonalHubParams) {
  const seed = slugifyHandle(params.name) || slugifyHandle(params.email.split("@")[0] ?? "hub");

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const handle = attempt === 0 ? seed : `${seed}-${attempt + 1}`.slice(0, 60);
    // Never issue a reserved handle at sign-up (the bare seed can be one, e.g.
    // a user named "Explore"); the suffixed forms below are never reserved.
    if (isReservedHandle(handle)) {
      continue;
    }
    const existing = await prisma.hub.findUnique({ where: { handle } });
    if (existing) {
      continue;
    }
    try {
      return await prisma.hub.create({
        data: { ownerUserId: params.userId, handle },
      });
    } catch {
      // Lost a race on the unique handle; try the next suffix.
    }
  }

  // Suffix space exhausted: fall back to random handles. NOT the user id —
  // ids are UUIDv7, whose leading hex chars are a timestamp, so id prefixes
  // collide for users created close together.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.hub.create({
        data: {
          ownerUserId: params.userId,
          handle: `hub-${randomBytes(4).toString("hex")}`,
        },
      });
    } catch {
      // Astronomically unlikely random collision; try again.
    }
  }
  throw new Error("Could not derive a unique hub handle");
}
