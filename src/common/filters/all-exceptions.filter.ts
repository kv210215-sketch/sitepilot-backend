import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

/**
 * Catches every thrown exception and returns a consistent JSON envelope.
 * 5xx errors are logged with their full stack; 4xx are silent.
 * requestId is included to correlate client-side errors with server logs.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.headers[REQUEST_ID_HEADER] as string | undefined;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → HTTP ${status}${requestId ? ` rid=${requestId}` : ''}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const safeMessage =
      status >= 500 && isProduction ? 'Internal server error' : rawMessage;

    const body: Record<string, unknown> = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: safeMessage,
    };
    if (requestId) body['requestId'] = requestId;

    response.status(status).json(body);
  }
}
