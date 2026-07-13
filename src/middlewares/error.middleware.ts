import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { fail } from '../utils/responseHandler';
import { logger } from '../utils/logger';

export function notFoundHandler(_req: Request, res: Response) {
  return fail(res, 'Route not found', 404);
}

// Turn a Sequelize validation/notNull error list into a { field: message } map
// with human-friendly wording.
function fieldMap(err: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of err?.errors ?? []) {
    const field = e.path || 'value';
    if (e.validatorKey === 'is_null' || e.type === 'notNull Violation') {
      out[field] = `${field} is required`;
    } else if (e.validatorKey === 'not_unique') {
      out[field] = `${field} already exists`;
    } else {
      out[field] = e.message?.replace(/^Validation error: /, '') || `${field} is invalid`;
    }
  }
  return out;
}

// Map raw Postgres error codes to readable messages.
function pgMessage(err: any): string | null {
  const code = err?.original?.code || err?.parent?.code;
  const detail = err?.original?.detail || err?.parent?.detail || '';
  switch (code) {
    case '23502': // not_null_violation
      return `${err?.original?.column || 'A required field'} is required`;
    case '23503': // foreign_key_violation
      return 'A referenced record does not exist (check the selected item)';
    case '23505': // unique_violation
      return detail ? detail.replace(/^Key /, '').replace(/\.$/, '') : 'A record with these details already exists';
    case '22P02': // invalid_text_representation (bad uuid / bad enum value)
      return 'One of the selected values is invalid';
    case '22007':
    case '22008': // invalid datetime
      return 'A date/time value is invalid';
    default:
      return null;
  }
}

// Global error handler: maps AppError + every common Sequelize error to a clean
// status + message (+ field map) so the client can show useful feedback instead
// of a generic 500.
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  // 1. Our own typed errors.
  if (err instanceof AppError) {
    return fail(res, err.message, err.statusCode, err.errors);
  }

  const name = err?.name;

  // 2. Validation / notNull violations → 422 with a per-field map.
  if (name === 'SequelizeValidationError') {
    const errors = fieldMap(err);
    const first = Object.values(errors)[0] || 'Validation failed';
    return fail(res, first, 422, errors);
  }

  // 3. Unique constraint → 409 with the offending field(s). For composite
  // uniques like (organization_id, slug), drop the tenant column so the message
  // names the field the user actually controls.
  if (name === 'SequelizeUniqueConstraintError') {
    const errors = fieldMap(err);
    if (Object.keys(errors).length > 1) {
      delete errors.organizationId;
      delete errors.organization_id;
    }
    const first = Object.values(errors)[0] || 'A record with these details already exists';
    return fail(res, first, 409, errors);
  }

  // 4. Foreign key → depends on operation.
  if (name === 'SequelizeForeignKeyConstraintError') {
    if (req.method === 'DELETE') {
      return fail(res, 'Cannot delete: this record is still referenced by other data', 409);
    }
    return fail(res, 'A referenced record does not exist (check the selected item)', 400);
  }

  // 5. Other database errors (bad uuid, bad enum, invalid syntax…).
  if (name === 'SequelizeDatabaseError') {
    const msg = pgMessage(err);
    return fail(res, msg || 'Invalid data submitted', 400);
  }

  // 6. Anything else that carries a status.
  if (err?.statusCode) {
    return fail(res, err.message ?? 'Error', err.statusCode);
  }

  logger.error({ err }, 'Unhandled error');
  return fail(res, 'Internal server error', 500);
}
