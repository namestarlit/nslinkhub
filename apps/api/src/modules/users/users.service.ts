import { Injectable, NotFoundException } from "@nestjs/common";
import type { Profile } from "@nslinkhub/types";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { PrismaService } from "src/database/prisma.service";
import { User } from "src/generated/prisma/client";
import { HubsService } from "../hubs/hubs.service";
import { UpdateUserDto } from "./dto/update-user.dto";

// Self-service profile. In the individual model a user has no public username;
// the public identity is their hub handle (see the hub page), and everything
// here operates on the authenticated user only.
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hubs: HubsService,
  ) {}

  async getMe(actor: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id: actor.userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.toProfile(user);
  }

  handleAvailability(actor: AuthUser, handle: string) {
    return this.hubs.handleAvailability(actor.userId, handle);
  }

  async updateMe(actor: AuthUser, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: actor.userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const data: { name?: string; showNameOnHub?: boolean } = {};

    if (dto.displayName !== undefined && dto.displayName !== user.name) {
      data.name = dto.displayName;
    }

    if (dto.showNameOnHub !== undefined) data.showNameOnHub = dto.showNameOnHub;

    // The handle lives on the hub; validated + uniqueness-checked there.
    if (dto.handle) {
      await this.hubs.updateHandle(user.id, dto.handle);
    }

    if (dto.hubName !== undefined) await this.hubs.updateName(user.id, dto.hubName);
    if (dto.hubDescription !== undefined)
      await this.hubs.updateDescription(user.id, dto.hubDescription);

    const saved = await this.prisma.user.update({ where: { id: user.id }, data });
    return this.toProfile(saved);
  }

  private async toProfile(user: User): Promise<Profile> {
    const hub = await this.prisma.hub.findUnique({
      where: { ownerUserId: user.id },
      select: { id: true, handle: true, name: true, description: true },
    });
    return {
      id: user.id,
      displayName: user.name,
      showNameOnHub: user.showNameOnHub,
      handle: hub?.handle ?? null,
      hubId: hub?.id ?? null,
      hubName: hub?.name ?? null,
      email: user.email,
      hubDescription: hub?.description ?? null,
      image: user.image,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
