import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

/**
 * Logs every HTTP request with method, URL, status code, latency, and request-id.
 * Never logs request or response bodies to avoid leaking sensitive data.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const { method, url } = req;
    const rid = req.headers[REQUEST_ID_HEADER] as string | undefined;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        const status = res.statusCode;
        this.logger.log(
          `${method} ${url} ${status} +${ms}ms${rid ? ` rid=${rid}` : ''}`,
        );
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - start;
        const status =
          typeof (err as { status?: number }).status === 'number'
            ? (err as { status: number }).status
            : 500;
        this.logger.error(
          `${method} ${url} ${status} +${ms}ms${rid ? ` rid=${rid}` : ''}`,
        );
        return throwError(() => err);
      }),
    );
  }
}
