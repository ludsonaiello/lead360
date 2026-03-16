import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedPortalUser } from '../entities/portal-jwt-payload.entity';

export const CurrentPortalUser = createParamDecorator(
  (data: keyof AuthenticatedPortalUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedPortalUser;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
