import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Catches every thrown exception and returns a consistent JSON envelope.
 * 5xx errors are logged with their full stack; 4xx are silent.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Log 5xx with stack; skip 4xx noise
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → HTTP ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Never leak internal error details in production
    const isProduction = process.env.NODE_ENV === 'production';
    const safeMessage =
      status >= 500 && isProduction
        ? 'Internal server error'
        : rawMessage;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: safeMessage,
    });
  }
}
