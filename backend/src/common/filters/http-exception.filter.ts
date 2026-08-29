import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/// Normalizes every thrown HttpException (including DomainError) into the
/// {code, message, details} envelope from
/// docs/obbel-coffee-ai-docs/09-api-rpc-contract.md §15.
@Catch(HttpException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === 'object' && body !== null && 'code' in body) {
      response.status(status).json(body);
      return;
    }

    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? (body as { message: unknown }).message
        : exception.message;

    response.status(status).json({
      code: HttpStatus[status] ?? 'ERROR',
      message,
      details: undefined,
    });
  }
}
