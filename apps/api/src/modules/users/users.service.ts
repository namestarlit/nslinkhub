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

  async updateMe(actor: AuthUser, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: actor.userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const data: { name?: string; bio?: string | null } = {};

    if (dto.displayName && dto.displayName !== user.name) {
      data.name = dto.displayName;
    }

    if (dto.bio !== undefined) {
      data.bio = dto.bio;
    }

    // The handle lives on the hub; validated + uniqueness-checked there.
    if (dto.handle) {
      await this.hubs.updateHandle(user.id, dto.handle);
    }

    const saved = await this.prisma.user.update({ where: { id: user.id }, data });
    return this.toProfile(saved);
  }

  private async toProfile(user: User): Promise<Profile> {
    const hub = await this.prisma.hub.findUnique({
      where: { ownerUserId: user.id },
      select: { id: true, handle: true },
    });
    return {
      id: user.id,
      displayName: user.name,
      handle: hub?.handle ?? null,
      hubId: hub?.id ?? null,
      email: user.email,
      bio: user.bio,
      image: user.image,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
