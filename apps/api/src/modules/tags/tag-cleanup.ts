import { PrismaService } from "src/database/prisma.service";

// Tags are global (unique by name, shared across every hub and user), so a tag
// is "unused" only when nothing references it anywhere — no collection_tags and
// no resource_tags. Prune such orphans so the shared tag table never
// accumulates dangling labels.
//
// Pass the specific tag ids touched by a mutation to scope the sweep (cheap,
// used by the detach paths); omit them for a full sweep after a cascading
// delete whose orphaned tags cannot be enumerated up front.
export async function pruneOrphanTags(prisma: PrismaService, tagIds?: string[]): Promise<void> {
  if (tagIds && tagIds.length === 0) {
    return;
  }
  await prisma.tag.deleteMany({
    where: {
      ...(tagIds ? { id: { in: tagIds } } : {}),
      collectionTags: { none: {} },
      resourceTags: { none: {} },
    },
  });
}
