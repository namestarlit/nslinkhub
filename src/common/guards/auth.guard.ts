import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { Request } from 'express';
import { auth } from 'src/auth/auth';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';

export function toAuthUser(user: {
  id: string;
  username?: string | null;
  role?: string | null;
}): AuthUser {
  return {
    userId: user.id,
    username: user.username ?? '',
    role: (user.role ?? UserRole.USER) as UserRole,
  };
}

export async function resolveSessionUser(
  request: Request,
): Promise<AuthUser | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    return null;
  }

  return toAuthUser(session.user);
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    const user = await resolveSessionUser(request);
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = user;
    return true;
  }
}
