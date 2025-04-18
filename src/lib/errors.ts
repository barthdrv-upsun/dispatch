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
