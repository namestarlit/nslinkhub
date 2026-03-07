import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    // passport-jwt strategy constructor typing is not precise for eslint's unsafe-call rule.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      jwtFromRequest: (request: Request) => {
        const auth = request.headers.authorization;
        if (!auth) {
          return null;
        }

        const [scheme, token] = auth.split(' ');
        if (scheme?.toLowerCase() !== 'bearer' || !token) {
          return null;
        }

        return token;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_ACCESS_SECRET',
        'dev-access-secret',
      ),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  }
}
