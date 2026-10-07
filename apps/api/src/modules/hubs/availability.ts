import type { Prisma } from "../../generated/prisma/client";

// Restrict the destination itself before pagination; references do not inherit holds.
export function availableCollections(ownerId?: string): Prisma.CollectionWhereInput {
  const clear: Prisma.CollectionWhereInput = {
    OR: [{ hold: { is: null } }, { hold: { is: { active: false } } }],
  };
  return {
    hub: { owner: { accountState: "active" } },
    ...(ownerId ? { OR: [{ hub: { ownerUserId: ownerId } }, clear] } : clear),
  };
}
