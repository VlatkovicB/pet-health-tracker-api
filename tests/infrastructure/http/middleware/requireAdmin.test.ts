import 'reflect-metadata';
import { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../../../../src/infrastructure/http/middleware/requireAdmin';
import { ForbiddenError } from '../../../../src/shared/errors/AppError';

function makeReq(role: string): Request {
  return { auth: { userId: 'u1', email: 'a@b.com', role } } as unknown as Request;
}

describe('requireAdmin', () => {
  it('calls next() for admin users', () => {
    const next = jest.fn() as unknown as NextFunction;
    requireAdmin(makeReq('admin'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ForbiddenError) for non-admin users', () => {
    const next = jest.fn() as unknown as NextFunction;
    requireAdmin(makeReq('user'), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
