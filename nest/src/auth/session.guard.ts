import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../common/public.decorator';

/** Global guard: every route needs a session unless it is marked @Public(). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    if (!ctx.switchToHttp().getRequest().user) throw new UnauthorizedException('Authentication required.');
    return true;
  }
}
