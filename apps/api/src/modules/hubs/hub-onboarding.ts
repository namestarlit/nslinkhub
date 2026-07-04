// Framework-free hub bootstrap. Kept importable with a relative path to the
// generated client so the standalone better-auth instance (src/auth/auth.ts,
// loaded by the better-auth CLI, which cannot resolve the `src/*` alias) can
// call it from its user-create hook. This is the single onboarding entry
// point — any auth path (local sign-up today, SSO later) funnels through it.
import type { PrismaClient } from "../../generated/prisma/client";

type HubCapableClient = Pick<PrismaClient, "hub">;

export interface PersonalHubParams {
  userId: string;
  name: string;
}

// Atomically create a hub and the creator's owner membership. The membership
// is a nested write, so both rows commit together.
export async function createPersonalHub(prisma: HubCapableClient, params: PersonalHubParams) {
  return prisma.hub.create({
    data: {
      name: params.name,
      memberships: {
        create: { userId: params.userId, role: "owner" },
      },
    },
  });
}
