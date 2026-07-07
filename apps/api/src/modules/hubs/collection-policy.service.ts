import { createHash } from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { PrismaService } from "src/database/prisma.service";
import { Collection } from "src/generated/prisma/client";

export interface CollectionAccess {
  canRead: boolean;
  canWriteContent: boolean; // resources, tags, imports (owner or direct editor)
  canManage: boolean; // publish, share, delete, settings (owner only)
  viaLinkToken: boolean; // access came from a presented share token
  isOwner: boolean; // the viewer owns the hub holding this collection
  // The ancestor collection whose link token matched (where link access came
  // from), so a recorded link share attaches to the shared collection itself.
  linkSourceCollectionId: string | null;
}

const NO_ACCESS: CollectionAccess = {
  canRead: false,
  canWriteContent: false,
  canManage: false,
  viaLinkToken: false,
  isOwner: false,
  linkSourceCollectionId: null,
};

type ChainLink = {
  id: string;
  published: boolean;
  linkSharingEnabled: boolean;
  shareTokenHash: string | null;
};

// The single source of truth for collection access (design "Sharing Model").
// Individual/Drive model: the hub owner has full authority; everyone else gets
// at most what a direct share -> active link (row or token) -> publication
// grants. Access inherits DOWN the tree — a grant on any ancestor applies to a
// descendant, exactly like sharing a Drive folder shares its contents. No
// memberships, no admin bypass.
@Injectable()
export class CollectionPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    collection: Collection,
    viewer: AuthUser | null,
    shareToken?: string,
  ): Promise<CollectionAccess> {
    // Owner of the hub holding the collection has full authority over the whole
    // subtree (a subtree always lives in a single hub).
    if (viewer) {
      const hub = await this.prisma.hub.findUnique({
        where: { id: collection.hubId },
        select: { ownerUserId: true },
      });
      if (hub?.ownerUserId === viewer.userId) {
        return {
          canRead: true,
          canWriteContent: true,
          canManage: true,
          viaLinkToken: false,
          isOwner: true,
          linkSourceCollectionId: null,
        };
      }
    }

    // Non-owner: a grant on the collection OR any ancestor applies. Walk the
    // ancestor chain (same hub, depth-bounded by the hierarchy trigger).
    const chain = await this.ancestorChain(collection);
    const chainById = new Map(chain.map((c) => [c.id, c]));
    const chainIds = chain.map((c) => c.id);

    let canRead = false;
    let canWriteContent = false;
    let viaLinkToken = false;
    let linkSourceCollectionId: string | null = null;

    if (viewer) {
      const shares = await this.prisma.collectionShare.findMany({
        where: { userId: viewer.userId, collectionId: { in: chainIds } },
        select: { collectionId: true, role: true, source: true },
      });
      for (const share of shares) {
        if (share.source === "direct") {
          canRead = true;
          if (share.role === "editor") {
            canWriteContent = true;
          }
        } else if (
          share.source === "link" &&
          chainById.get(share.collectionId)?.linkSharingEnabled
        ) {
          canRead = true;
        }
      }
    }

    if (shareToken) {
      const hash = createHash("sha256").update(shareToken).digest("hex");
      const match = chain.find((c) => c.linkSharingEnabled && c.shareTokenHash === hash);
      if (match) {
        canRead = true;
        viaLinkToken = true;
        linkSourceCollectionId = match.id;
      }
    }

    if (chain.some((c) => c.published)) {
      canRead = true;
    }

    if (!canRead) {
      return NO_ACCESS;
    }

    return {
      canRead,
      canWriteContent,
      canManage: false,
      viaLinkToken,
      isOwner: false,
      linkSourceCollectionId,
    };
  }

  // The collection plus its ancestors (root last), carrying the fields access
  // resolution needs. Bounded by the depth-8 hierarchy trigger.
  private async ancestorChain(collection: Collection): Promise<ChainLink[]> {
    const chain: ChainLink[] = [
      {
        id: collection.id,
        published: collection.published,
        linkSharingEnabled: collection.linkSharingEnabled,
        shareTokenHash: collection.shareTokenHash,
      },
    ];
    let parentId = collection.parentCollectionId;
    let guard = 0;
    while (parentId && guard < 8) {
      const parent = await this.prisma.collection.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          published: true,
          linkSharingEnabled: true,
          shareTokenHash: true,
          parentCollectionId: true,
        },
      });
      if (!parent) {
        break;
      }
      chain.push({
        id: parent.id,
        published: parent.published,
        linkSharingEnabled: parent.linkSharingEnabled,
        shareTokenHash: parent.shareTokenHash,
      });
      parentId = parent.parentCollectionId;
      guard += 1;
    }
    return chain;
  }

  async requireRead(
    collection: Collection,
    viewer: AuthUser | null,
    shareToken?: string,
  ): Promise<CollectionAccess> {
    const access = await this.resolve(collection, viewer, shareToken);
    if (!access.canRead) {
      // Prefer 404 over 403 for resources the caller cannot know exist.
      throw new NotFoundException("Collection not found");
    }
    return access;
  }

  async requireWriteContent(collection: Collection, user: AuthUser): Promise<CollectionAccess> {
    const access = await this.resolve(collection, user);
    if (!access.canWriteContent) {
      throw new ForbiddenException("Forbidden");
    }
    return access;
  }

  async requireManage(collection: Collection, user: AuthUser): Promise<CollectionAccess> {
    const access = await this.resolve(collection, user);
    if (!access.canManage) {
      throw new ForbiddenException("Forbidden");
    }
    return access;
  }

  // When a signed-in non-owner opens a valid share link, remember it under their
  // shared/ surface — against the collection whose link was actually used (which
  // may be an ancestor of the one they navigated to). Never overwrite an
  // existing (e.g. direct) share.
  async recordLinkAccess(collectionId: string, userId: string): Promise<void> {
    const existing = await this.prisma.collectionShare.findUnique({
      where: { collectionId_userId: { collectionId, userId } },
      select: { collectionId: true },
    });
    if (existing) {
      return;
    }
    await this.prisma.collectionShare.create({
      data: { collectionId, userId, role: "reader", source: "link" },
    });
  }
}
