import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { HandleAvailability } from "@nslinkhub/types";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { PrismaService } from "src/database/prisma.service";
import { recordAudit } from "../../common/audit";
import { appError } from "../../common/errors/app-exception";
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

  async handleAvailability(userId: string, rawHandle: string): Promise<HandleAvailability> {
    const handle = rawHandle.trim().toLowerCase();
    if (!hasValidHandleFormat(handle)) return { handle, status: "invalid" };
    if (isReservedHandle(handle)) return { handle, status: "reserved" };
    const hub = await this.prisma.hub.findUnique({
      where: { handle },
      select: { ownerUserId: true },
    });
    return {
      handle,
      status: !hub ? "available" : hub.ownerUserId === userId ? "current" : "taken",
    };
  }

  async updateName(userId: string, rawName: string) {
    const name = rawName.trim();
    if (!name || name.length > 255) throw new BadRequestException("Invalid hub name");
    const hub = await this.prisma.hub.findUnique({ where: { ownerUserId: userId } });
    if (!hub) throw new NotFoundException("Hub not found");
    if (hub.name === name) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.hub.update({ where: { id: hub.id, ownerUserId: userId }, data: { name } });
      await recordAudit(tx, { hubId: hub.id, actorUserId: userId, action: "hub.name_changed" });
    });
  }

  async updateDescription(userId: string, rawDescription: string) {
    if (rawDescription.length > 5000) throw new BadRequestException("Invalid hub description");
    const description = rawDescription.trim() || null;
    const hub = await this.prisma.hub.findUnique({ where: { ownerUserId: userId } });
    if (!hub) throw new NotFoundException("Hub not found");
    if (hub.description === description) return;
    await this.prisma.hub.update({
      where: { id: hub.id, ownerUserId: userId },
      data: { description },
    });
  }

  // Rename the caller's hub handle. The handle is the mutable public identity;
  // durable links use the immutable hub id, so a rename never breaks a saved
  // link or a published-content reference.
  async updateHandle(userId: string, rawHandle: string) {
    const handle = rawHandle.trim().toLowerCase();
    if (!hasValidHandleFormat(handle)) {
      throw appError("handle_invalid");
    }
    if (isReservedHandle(handle)) {
      throw appError("handle_reserved");
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
        throw appError("handle_unavailable");
      }
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.hub.update({ where: { id: hub.id, ownerUserId: userId }, data: { handle } });
          await recordAudit(tx, {
            hubId: hub.id,
            actorUserId: userId,
            action: "hub.handle_changed",
          });
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        )
          throw appError("handle_unavailable");
        throw error;
      }
    }

    return { hubId: hub.id, handle };
  }
}
