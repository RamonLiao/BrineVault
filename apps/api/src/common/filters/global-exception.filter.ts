import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ZodError } from 'zod';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exResponse = exception.getResponse();
      const message =
        typeof exResponse === 'string'
          ? exResponse
          : ((exResponse as Record<string, unknown>).message as string) ??
            exception.message;
      const code =
        typeof exResponse === 'object' &&
        (exResponse as Record<string, unknown>).code
          ? ((exResponse as Record<string, unknown>).code as string)
          : `HTTP_${status}`;
      response.status(status).json({ error: { code, message } });
      return;
    }

    if (exception instanceof ZodError) {
      const details = exception.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details,
        },
      });
      return;
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : exception,
    );
    response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
}
