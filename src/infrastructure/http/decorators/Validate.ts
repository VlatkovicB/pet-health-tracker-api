import { UseBefore } from 'routing-controllers';
import { ZodSchema, ZodIssue } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../../shared/errors/AppError';

export function Validate(options: { body?: ZodSchema; query?: ZodSchema }) {
  return UseBefore((req: Request, _res: Response, next: NextFunction) => {
    try {
      if (options.body) {
        const result = options.body.safeParse(req.body);
        if (!result.success) throw toValidationError(result.error.issues);
        req.body = result.data;
      }
      if (options.query) {
        const result = options.query.safeParse(req.query);
        if (!result.success) throw toValidationError(result.error.issues);
        req.query = result.data as any;
      }
      next();
    } catch (err) {
      next(err);
    }
  });
}

function toValidationError(issues: ZodIssue[]) {
  const msg = issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return new ValidationError(msg);
}
