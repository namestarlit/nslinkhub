import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { Repository } from 'typeorm';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async getByUsername(username: string) {
    const user = await this.usersRepo.findOne({ where: { username } });

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
    const user = await this.usersRepo.findOne({ where: { username } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.ensureWriteAccess(actor, user.id);

    if (dto.username && dto.username !== user.username) {
      const exists = await this.usersRepo.exists({
        where: { username: dto.username },
      });
      if (exists) {
        throw new ConflictException('Username already exists');
      }
      user.username = dto.username;
    }

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const normalized = dto.email.toLowerCase();
      const exists = await this.usersRepo.exists({
        where: { email: normalized },
      });
      if (exists) {
        throw new ConflictException('Email already exists');
      }
      user.email = normalized;
    }

    if (dto.password) {
      user.passwordHash = await argon2.hash(dto.password);
    }

    if (dto.bio !== undefined) {
      user.bio = dto.bio;
    }

    const saved = await this.usersRepo.save(user);
    return this.toPublicUser(saved);
  }

  async deleteByUsername(username: string, actor: AuthUser) {
    const user = await this.usersRepo.findOne({ where: { username } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.ensureWriteAccess(actor, user.id);
    await this.usersRepo.remove(user);

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

  private toPublicUser(user: UserEntity) {
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
