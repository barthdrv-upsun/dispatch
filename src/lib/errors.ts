export type ErrorBody = {
  error: string;
  message: string;
  requiredRole?: string;
  details?: unknown;
};

export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;

  toBody(): ErrorBody {
    return { error: this.code, message: this.message };
  }
}

export class ValidationError extends AppError {
  readonly status = 400;
  readonly code = 'invalid_request';
  readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }

  override toBody(): ErrorBody {
    return { error: this.code, message: this.message, details: this.details };
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = 'not_found';
}

export class ConflictError extends AppError {
  readonly status = 409;
  readonly code = 'conflict';
}
