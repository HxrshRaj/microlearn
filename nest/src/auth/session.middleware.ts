import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { SESSION_COOKIE_NAME } from '../common/constants';
import { SessionService } from './session.service';

/** Attaches req.user when a valid session cookie exists; never rejects (the guard decides). */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  async use(req: Request & { user?: unknown }, _res: Response, next: NextFunction) {
    try {
      req.user = await this.sessions.userForToken((req as any).cookies?.[SESSION_COOKIE_NAME]);
    } catch {
      req.user = null;
    }
    next();
  }
}
