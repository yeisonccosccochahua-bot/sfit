import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../../entities/user.entity';

/**
 * Extrae el usuario autenticado del request.
 * Requiere JwtAuthGuard aplicado antes.
 * @example async getProfile(@CurrentUser() user: User)
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
