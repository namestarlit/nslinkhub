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
}

const NO_ACCESS: CollectionAccess = {
  canRead: false,
  canWriteContent: false,
  canManage: false,
  viaLinkToken: false,
  isOwner: false,
};

// The single source of truth for collection access (design "Sharing Model").
// Individual/Drive model: the hub owner has full authority; everyone else gets
// at most what a direct share -> active link (row or token) -> publication
// grants. No memberships, no admin bypass.
@Injectable()
export class CollectionPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    collection: Collection,
    viewer: AuthUser | null,
    shareToken?: string,
  ): Promise<CollectionAccess> {
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
        };
      }
    }

    // Non-member: accumulate the strongest read/write from shares, link, and
    // publication.
    let canRead = false;
    let canWriteContent = false;
    let viaLinkToken = false;

    if (viewer) {
      const share = await this.prisma.collectionShare.findUnique({
        where: {
          collectionId_userId: {
            collectionId: collection.id,
            userId: viewer.userId,
          },
        },
        select: { role: true, source: true },
      });
      if (share) {
        if (share.source === "direct") {
          canRead = true;
          if (share.role === "editor") {
            canWriteContent = true;
          }
        } else if (share.source === "link" && collection.linkSharingEnabled) {
          canRead = true;
        }
      }
    }

    if (collection.linkSharingEnabled && collection.shareTokenHash && shareToken) {
      const hash = createHash("sha256").update(shareToken).digest("hex");
      if (hash === collection.shareTokenHash) {
        canRead = true;
        viaLinkToken = true;
      }
    }

    if (collection.published) {
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
    };
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

  // When a signed-in non-member opens a valid share link, remember it under
  // their shared/ surface. Never overwrite an existing (e.g. direct) share.
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
