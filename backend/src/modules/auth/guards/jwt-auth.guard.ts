import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable, isObservable, lastValueFrom } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      // Optional auth: if no Authorization header, skip JWT entirely.
      // If token IS present, run the strategy so req.user gets populated
      // (needed for register endpoint where admin creates managed users).
      const req = context.switchToHttp().getRequest();
      if (!req.headers?.authorization) return true;
      // Token present — try to validate, but never reject the request.
      // super.canActivate can return boolean | Promise<boolean> | Observable<boolean>;
      // convert all forms to Promise<boolean> before attaching .catch().
      const result = super.canActivate(context);
      const asPromise: Promise<boolean> = isObservable(result)
        ? lastValueFrom(result)
        : Promise.resolve(result as boolean | Promise<boolean>);
      return asPromise.catch(() => true);
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // For public routes: a bad/missing token is not an error — just no user
    if (isPublic) return user ?? null;
    if (err || !user) {
      throw err || new UnauthorizedException('Token inválido o expirado');
    }
    return user;
  }
}
