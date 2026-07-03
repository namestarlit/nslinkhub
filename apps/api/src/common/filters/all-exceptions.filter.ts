import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from '../middleware/request-id';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    details: Record<string, unknown>;
  };
}

const STATUS_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'bad_request',
  [HttpStatus.UNAUTHORIZED]: 'unauthorized',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.CONFLICT]: 'conflict',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'payload_too_large',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'unsupported_media_type',
  [HttpStatus.TOO_MANY_REQUESTS]: 'too_many_requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'internal_error',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const requestId = request.requestId ?? 'req_unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: string | undefined;
    const details: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const shaped = body as {
          message?: string | string[];
          code?: string;
          details?: Record<string, unknown>;
        };

        if (Array.isArray(shaped.message)) {
          // ValidationPipe emits one message per failed constraint.
          message = 'Validation failed';
          code = 'validation_failed';
          details.messages = shaped.message;
        } else if (typeof shaped.message === 'string') {
          message = shaped.message;
        }

        // Domain exceptions may carry an explicit stable code.
        if (typeof shaped.code === 'string') {
          code = shaped.code;
        }
        if (shaped.details && typeof shaped.details === 'object') {
          Object.assign(details, shaped.details);
        }
      }
    } else {
      // Unknown failures are never reflected to the caller.
      this.logger.error(
        `Unhandled exception (${requestId})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const envelope: ErrorEnvelope = {
      error: {
        code: code ?? STATUS_CODES[status] ?? 'error',
        message,
        requestId,
        details,
      },
    };

    response.status(status).json(envelope);
  }
}
