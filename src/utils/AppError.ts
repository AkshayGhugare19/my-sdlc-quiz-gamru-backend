// Typed application error — services throw this, never res.json (gamru pattern).
export class AppError extends Error {
  statusCode: number;
  errors: unknown;
  code?: string;
  isOperational = true;

  constructor(message: string, statusCode = 400, errors: unknown = null, code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', errors?: unknown) {
    return new AppError(msg, 400, errors);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new AppError(msg, 401);
  }
  static forbidden(msg = 'Forbidden') {
    return new AppError(msg, 403);
  }
  static notFound(msg = 'Not found') {
    return new AppError(msg, 404);
  }
  static conflict(msg = 'Conflict') {
    return new AppError(msg, 409);
  }
  static unprocessable(msg = 'Unprocessable', errors?: unknown) {
    return new AppError(msg, 422, errors);
  }
}
