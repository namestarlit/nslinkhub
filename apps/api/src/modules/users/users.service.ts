import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { User } from 'src/generated/prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getByUsername(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toPublicUser(user);
  }

  async updateByUsername(
    username: string,
    actor: AuthUser,
    dto: UpdateUserDto,
  ) {
    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.ensureWriteAccess(actor, user.id);

    const data: {
      username?: string;
      displayUsername?: string;
      email?: string;
      bio?: string | null;
    } = {};

    if (dto.username && dto.username !== user.username) {
      const exists = await this.prisma.user.findUnique({
        where: { username: dto.username },
        select: { id: true },
      });
      if (exists) {
        throw new ConflictException('Username already exists');
      }
      data.username = dto.username;
      data.displayUsername = dto.username;
    }

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const normalized = dto.email.toLowerCase();
      const exists = await this.prisma.user.findUnique({
        where: { email: normalized },
        select: { id: true },
      });
      if (exists) {
        throw new ConflictException('Email already exists');
      }
      data.email = normalized;
    }

    if (dto.password) {
      // Password now lives on the better-auth credential account row.
      const passwordHash = await Bun.password.hash(dto.password, 'argon2id');
      await this.prisma.account.updateMany({
        where: { userId: user.id, providerId: 'credential' },
        data: { password: passwordHash },
      });
    }

    if (dto.bio !== undefined) {
      data.bio = dto.bio;
    }

    const saved = await this.prisma.user.update({
      where: { id: user.id },
      data,
    });
    return this.toPublicUser(saved);
  }

  async deleteByUsername(username: string, actor: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.ensureWriteAccess(actor, user.id);
    await this.prisma.user.delete({ where: { id: user.id } });

    return { id: user.id, deleted: true };
  }

  private ensureWriteAccess(actor: AuthUser, ownerId: string) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.userId !== ownerId) {
      throw new ForbiddenException('Forbidden');
    }
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
