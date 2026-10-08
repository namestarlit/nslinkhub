import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { from, lastValueFrom } from "rxjs";
import { PrismaService } from "../database/prisma.service";
import type { AuthUser } from "./interfaces/auth-user.interface";

export const AUTHORITY_AFTER_UPLOAD = "authorityAfterUpload";
export const READ_ONLY_COMMAND = "authorityReadOnlyCommand";
// A POST that only reads (e.g. rendering an export). It must not write: it runs
// outside the global authority lock so slow rendering never blocks other
// writes or hits the transaction timeout. The guard and policy still apply.
export const ReadOnlyCommand = () => SetMetadata(READ_ONLY_COMMAND, true);

@Injectable()
export class AuthorityInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const marked = (key: string) =>
      this.reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]);
    if (marked(AUTHORITY_AFTER_UPLOAD) || marked(READ_ONLY_COMMAND)) return next.handle();
    return this.authorize(context, next);
  }
  protected authorize(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (
      !req.user ||
      ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
      /^\/api\/v1\/operations(?:\/|$)/i.test(req.path)
    )
      return next.handle();
    const actor = req.user;
    return from(
      this.prisma.withAuthority(async () => {
        // The guard ran before the lock. Recheck the actual session under it.
        const session =
          actor.sessionId &&
          (await this.prisma.session.findFirst({
            where: {
              id: actor.sessionId,
              userId: actor.userId,
              expiresAt: { gt: new Date() },
              user: { accountState: "active" },
            },
          }));
        if (!session) throw new UnauthorizedException();
        return lastValueFrom(next.handle());
      }),
    );
  }
}

// Used after FileInterceptor has finished its bounded multipart parsing.
@Injectable()
export class ParsedUploadAuthorityInterceptor extends AuthorityInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return this.authorize(context, next);
  }
}
