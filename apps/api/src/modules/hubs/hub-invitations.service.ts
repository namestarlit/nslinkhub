import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { generateToken, hashToken } from "src/common/utils/token.util";
import { PrismaService } from "src/database/prisma.service";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { HubsService } from "./hubs.service";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class HubInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hubs: HubsService,
  ) {}

  async create(hubId: string, actor: AuthUser, dto: CreateInvitationDto) {
    await this.requireHubExists(hubId);
    // Inviting an admin is an owner action; inviting a member is admin+.
    await this.hubs.requireHubRole(hubId, actor, dto.role === "admin" ? "owner" : "admin");

    const { token, tokenHash } = generateToken();
    const invitation = await this.prisma.hubInvitation.create({
      data: {
        hubId,
        email: dto.email.trim().toLowerCase(),
        role: dto.role,
        tokenHash,
        status: "pending",
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });

    // Email delivery is a logged no-op until email infrastructure exists.
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      // Raw token shown once; a real deployment mails it, never returns it.
      token,
    };
  }

  async list(hubId: string, actor: AuthUser) {
    await this.requireHubExists(hubId);
    await this.hubs.requireHubRole(hubId, actor, "admin");
    const invitations = await this.prisma.hubInvitation.findMany({
      where: { hubId, status: "pending" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    return invitations;
  }

  async revoke(hubId: string, actor: AuthUser, invitationId: string) {
    await this.hubs.requireHubRole(hubId, actor, "admin");
    const invitation = await this.prisma.hubInvitation.findFirst({
      where: { id: invitationId, hubId },
    });
    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }
    if (invitation.status === "pending") {
      await this.prisma.hubInvitation.update({
        where: { id: invitation.id },
        data: { status: "revoked" },
      });
    }
    return { id: invitation.id, revoked: true };
  }

  async accept(actor: AuthUser, token: string) {
    const invitation = await this.prisma.hubInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }
    if (invitation.status !== "pending") {
      throw new BadRequestException("Invitation is no longer valid");
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.prisma.hubInvitation.update({
        where: { id: invitation.id },
        data: { status: "expired" },
      });
      throw new BadRequestException("Invitation has expired");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { email: true },
    });
    if (!user || user.email.toLowerCase() !== invitation.email) {
      throw new ForbiddenException("This invitation is for a different account");
    }

    const existing = await this.prisma.hubMembership.findUnique({
      where: {
        hubId_userId: { hubId: invitation.hubId, userId: actor.userId },
      },
      select: { hubId: true },
    });
    if (!existing) {
      await this.prisma.hubMembership.create({
        data: {
          hubId: invitation.hubId,
          userId: actor.userId,
          role: invitation.role,
        },
      });
    }

    await this.prisma.hubInvitation.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    });

    return { hubId: invitation.hubId, role: invitation.role };
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
}
