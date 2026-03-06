import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { UserRole } from 'src/common/enums/user-role.enum';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const exists = await this.usersRepo.exists({
      where: [{ username: dto.username }, { email: normalizedEmail }],
    });

    if (exists) {
      throw new BadRequestException('Username or email already exists');
    }

    const user = this.usersRepo.create({
      username: dto.username,
      email: normalizedEmail,
      passwordHash: await argon2.hash(dto.password),
      role: UserRole.USER,
    });

    const saved = await this.usersRepo.save(user);
    const tokens = await this.issueTokenPair(saved);

    return {
      user: this.toPublicUser(saved),
      tokens,
    };
  }

  async login(dto: LoginDto) {
    const identity = dto.usernameOrEmail.trim();
    const user = await this.usersRepo.findOne({
      where: [
        { username: identity },
        { email: identity.toLowerCase() },
      ],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokenPair(user);
    return {
      user: this.toPublicUser(user),
      tokens,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'dev-refresh-secret',
    );

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.issueTokenPair(user);
    return {
      user: this.toPublicUser(user),
      tokens,
    };
  }

  async logout(_dto: RefreshTokenDto) {
    return {
      message: 'Logged out',
    };
  }

  private async issueTokenPair(user: UserEntity) {
    const accessPayload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      tokenType: 'access',
    };

    const refreshPayload: JwtPayload = {
      ...accessPayload,
      tokenType: 'refresh',
    };

    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'dev-refresh-secret',
    );
    const refreshTtl = this.configService.get<string>('JWT_REFRESH_TTL', '7d');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshTtl as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
    };
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
