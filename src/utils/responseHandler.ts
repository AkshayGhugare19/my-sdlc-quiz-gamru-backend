import type { Request, Response, NextFunction } from 'express';

// Consistent envelope: { success, message, data|errors, timestamp }
export function ok(res: Response, data: unknown = null, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, data, timestamp: new Date().toISOString() });
}

export function created(res: Response, data: unknown = null, message = 'Created') {
  return ok(res, data, message, 201);
}

export function fail(res: Response, message = 'Error', status = 400, errors: unknown = null) {
  return res.status(status).json({ success: false, message, errors, timestamp: new Date().toISOString() });
}

// Wrap async handlers so thrown errors reach the error middleware.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
