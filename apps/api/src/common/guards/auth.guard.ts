import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import { Request } from "express";
import { auth } from "src/auth/auth";
import { AuthUser } from "src/common/interfaces/auth-user.interface";

export async function resolveSessionUser(request: Request): Promise<AuthUser | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    return null;
  }

  return { userId: session.user.id, sessionId: session.session.id };
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();

    const user = await resolveSessionUser(request);
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = user;
    return true;
  }
}
