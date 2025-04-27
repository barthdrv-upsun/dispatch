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

/**
 * Raised by the route guards before any handler work happens. The body names
 * the role the caller would have needed, because "forbidden" on its own sends
 * coaches to the wrong person.
 */
export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = 'forbidden';
  readonly requiredRole: string;
  readonly action: string;

  constructor(action: string, requiredRole: string, message?: string) {
    super(message ?? `${action} requires the ${requiredRole} role`);
    this.action = action;
    this.requiredRole = requiredRole;
  }

  override toBody(): ErrorBody {
    return { error: this.code, message: this.message, requiredRole: this.requiredRole };
  }
}

export class UnauthenticatedError extends AppError {
  readonly status = 401;
  readonly code = 'unauthenticated';
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
