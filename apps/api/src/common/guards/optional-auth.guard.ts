import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { resolveSessionUser } from "./auth.guard";

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser | null }>();

    try {
      request.user = await resolveSessionUser(request);
    } catch {
      request.user = null;
    }

    return true;
  }
}
