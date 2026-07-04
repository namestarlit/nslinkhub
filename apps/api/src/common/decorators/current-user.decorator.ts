import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { AuthUser } from "src/common/interfaces/auth-user.interface";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | null => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    return request.user ?? null;
  },
);
