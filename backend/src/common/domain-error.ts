import { HttpException, HttpStatus } from '@nestjs/common';

/// Error envelope per docs/obbel-coffee-ai-docs/09-api-rpc-contract.md §15:
/// { code, message, details }. Use this instead of throwing generic
/// HttpExceptions for business-rule violations so the client gets a stable
/// machine-readable `code` (SHIFT_NOT_OPEN, INSUFFICIENT_STOCK, dst).
export class DomainError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message, details }, status);
  }
}
