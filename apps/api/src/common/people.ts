import type { PersonRef } from "@nslinkhub/types";
import type { Prisma } from "../generated/prisma/client";

// People as they appear anywhere in the product: their @handle (a name is shown
// only on their own hub page). Suspended accounts and people without a hub are
// left out.
export async function personRefs(
  db: Pick<Prisma.TransactionClient, "user">,
  userIds: Iterable<string | null | undefined>,
): Promise<Map<string, PersonRef>> {
  const ids = [...new Set([...userIds].filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: ids }, accountState: "active" },
    select: {
      id: true,
      hub: { select: { id: true, handle: true } },
    },
  });
  return new Map(
    users.flatMap((user): [string, PersonRef][] =>
      user.hub ? [[user.id, { hubId: user.hub.id, handle: user.hub.handle }]] : [],
    ),
  );
}
