import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../../shared/errors/AppError';

export interface AuthPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError());
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
