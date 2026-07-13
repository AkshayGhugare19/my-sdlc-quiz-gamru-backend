import type { Request, Response, NextFunction } from 'express';
import type { Schema } from 'joi';
import { fail } from '../utils/responseHandler';

type Source = 'body' | 'query' | 'params';

// Joi validation (gamru validate.middleware pattern): on failure returns 422
// with a { field: message } map; on success overwrites req[source] with the
// coerced value.
export function validate(schema: Schema, source: Source = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      const errors: Record<string, string> = {};
      for (const d of error.details) errors[d.path.join('.')] = d.message;
      return fail(res, 'Validation failed', 422, errors);
    }
    (req as any)[source] = value;
    return next();
  };
}
