import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { PrismaService } from "src/database/prisma.service";
import { hasValidHandleFormat, isReservedHandle } from "./handle";

// Hub authority for the individual (Google-Drive) model: each user owns exactly
// one hub — their personal space. Ownership is the only hub authority;
// collection-level reader/editor sharing lives in CollectionPolicyService.
@Injectable()
export class HubsService {
  constructor(private readonly prisma: PrismaService) {}

  // The user's one hub (their space).
  async getUserHubId(userId: string): Promise<string | null> {
    const hub = await this.prisma.hub.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    return hub?.id ?? null;
  }

  async isOwner(hubId: string, userId: string): Promise<boolean> {
    const hub = await this.prisma.hub.findUnique({
      where: { id: hubId },
      select: { ownerUserId: true },
    });
    return hub?.ownerUserId === userId;
  }

  // Full authority over a hub belongs to its owner alone.
  async requireHubOwner(hubId: string, user: AuthUser): Promise<void> {
    if (!(await this.isOwner(hubId, user.userId))) {
      throw new ForbiddenException("Forbidden");
    }
  }

  async getHubByHandle(handle: string) {
    return this.prisma.hub.findUnique({ where: { handle: handle.trim().toLowerCase() } });
  }

  // Rename the caller's hub handle. The handle is the mutable public identity;
  // durable links use the immutable hub id, so a rename never breaks a saved
  // link or a published-content reference.
  async updateHandle(userId: string, rawHandle: string) {
    const handle = rawHandle.trim().toLowerCase();
    if (!hasValidHandleFormat(handle)) {
      throw new BadRequestException(
        "Handle must be 3-60 chars, lowercase letters, digits, hyphens",
      );
    }
    if (isReservedHandle(handle)) {
      throw new BadRequestException("Handle is reserved");
    }

    const hub = await this.prisma.hub.findUnique({
      where: { ownerUserId: userId },
      select: { id: true, handle: true },
    });
    if (!hub) {
      throw new NotFoundException("Hub not found");
    }

    if (hub.handle !== handle) {
      const taken = await this.prisma.hub.findUnique({
        where: { handle },
        select: { id: true },
      });
      if (taken) {
        throw new BadRequestException("Handle already taken");
      }
      await this.prisma.hub.update({ where: { id: hub.id }, data: { handle } });
    }

    return { hubId: hub.id, handle };
  }
}
