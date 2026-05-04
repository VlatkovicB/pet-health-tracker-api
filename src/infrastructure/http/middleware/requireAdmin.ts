import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../../shared/errors/AppError';

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== 'admin') {
    return next(new ForbiddenError('Admin access required'));
  }
  next();
}
