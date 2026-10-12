import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { join } from 'path';

/** Keeps the Express server's `{ error: string }` response shape and its SPA fallback. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (exception instanceof NotFoundException && req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(join(__dirname, '..', '..', '..', 'public', 'index.html'));
    }
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : ((body as any).error_message ?? (body as any).message ?? exception.message);
      return res.status(exception.getStatus()).json({ error: Array.isArray(message) ? message[0] : message });
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Something went wrong. Please try again.' });
  }
}
