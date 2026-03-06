import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | null => {
    const request = ctx.switchToHttp().getRequest();
    return (request.user as AuthUser | undefined) ?? null;
  },
);
