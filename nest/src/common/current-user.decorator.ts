import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface SessionUser { id: number | string; username: string; email: string; created_at: Date }

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): SessionUser | null => {
  return ctx.switchToHttp().getRequest().user ?? null;
});
