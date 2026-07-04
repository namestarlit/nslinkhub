import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { PrismaService } from "src/database/prisma.service";
import { HubsService } from "./hubs.service";

@Injectable()
export class HubMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hubs: HubsService,
  ) {}

  async listMembers(hubId: string, actor: AuthUser) {
    await this.requireHubExists(hubId);
    await this.hubs.requireHubRole(hubId, actor, "member");
    const members = await this.prisma.hubMembership.findMany({
      where: { hubId },
      include: { user: { select: { id: true, username: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      name: m.user.name,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt,
    }));
  }

  // Role changes are owner-only: the only meaningful change is the admin
  // grant/revoke, which the design reserves to owners. The owner role itself
  // is reachable only via transfer-ownership.
  async changeRole(hubId: string, actor: AuthUser, targetUserId: string, role: "member" | "admin") {
    await this.hubs.requireHubRole(hubId, actor, "owner");
    const target = await this.requireMembership(hubId, targetUserId);
    if (target.role === "owner") {
      throw new BadRequestException("Cannot change an owner role; use transfer-ownership");
    }
    const updated = await this.prisma.hubMembership.update({
      where: { hubId_userId: { hubId, userId: targetUserId } },
      data: { role },
    });
    return { hubId, userId: targetUserId, role: updated.role };
  }

  async removeMember(hubId: string, actor: AuthUser, targetUserId: string) {
    const target = await this.requireMembership(hubId, targetUserId);
    const isSelf = actor.userId === targetUserId;

    if (isSelf) {
      // Leaving is allowed unless it would strip the hub of its last owner.
      if (target.role === "owner" && (await this.hubs.countOwners(hubId)) <= 1) {
        throw new BadRequestException("A hub must keep at least one owner");
      }
    } else {
      // Removing a member needs admin+; removing an admin or owner needs owner.
      await this.hubs.requireHubRole(hubId, actor, target.role === "member" ? "admin" : "owner");
      if (target.role === "owner" && (await this.hubs.countOwners(hubId)) <= 1) {
        throw new BadRequestException("A hub must keep at least one owner");
      }
    }

    await this.prisma.hubMembership.delete({
      where: { hubId_userId: { hubId, userId: targetUserId } },
    });
    return { hubId, userId: targetUserId, removed: true };
  }

  async transferOwnership(hubId: string, actor: AuthUser, targetUserId: string) {
    await this.hubs.requireHubRole(hubId, actor, "owner");
    if (targetUserId === actor.userId) {
      throw new BadRequestException("Cannot transfer ownership to yourself");
    }
    await this.requireMembership(hubId, targetUserId);

    await this.prisma.$transaction([
      this.prisma.hubMembership.update({
        where: { hubId_userId: { hubId, userId: targetUserId } },
        data: { role: "owner" },
      }),
      this.prisma.hubMembership.update({
        where: { hubId_userId: { hubId, userId: actor.userId } },
        data: { role: "admin" },
      }),
    ]);

    return { hubId, ownerId: targetUserId };
  }

  private async requireHubExists(hubId: string) {
    const hub = await this.prisma.hub.findUnique({
      where: { id: hubId },
      select: { id: true },
    });
    if (!hub) {
      throw new NotFoundException("Hub not found");
    }
  }

  private async requireMembership(hubId: string, userId: string) {
    const membership = await this.prisma.hubMembership.findUnique({
      where: { hubId_userId: { hubId, userId } },
    });
    if (!membership) {
      throw new NotFoundException("Member not found");
    }
    return membership;
  }
}
