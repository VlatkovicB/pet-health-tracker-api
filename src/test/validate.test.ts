import 'reflect-metadata';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { z } from 'zod';

// Mock routing-controllers before importing Validate so UseBefore is interceptable
jest.mock('routing-controllers', () => ({
  ...jest.requireActual('routing-controllers'),
  UseBefore: jest.fn((fn: unknown) => fn),
}));

import { UseBefore } from 'routing-controllers';
import { Validate } from '../infrastructure/http/decorators/Validate';
import { errorMiddleware } from '../infrastructure/http/middleware/errorMiddleware';

function extractMiddleware(schema: Parameters<typeof Validate>[0]): (req: Request, res: Response, next: NextFunction) => void {
  const mockedUseBefore = UseBefore as jest.MockedFunction<typeof UseBefore>;
  mockedUseBefore.mockImplementationOnce((fn: unknown) => fn as ReturnType<typeof UseBefore>);
  Validate(schema);
  const calls = mockedUseBefore.mock.calls;
  const lastCall = calls[calls.length - 1];
  return lastCall[0] as any;
}

describe('@Validate decorator', () => {
  const BodySchema = z.object({ name: z.string().min(1), age: z.number() });
  const QuerySchema = z.object({ page: z.coerce.number().default(1) });

  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    const bodyMiddleware = extractMiddleware({ body: BodySchema });
    const queryMiddleware = extractMiddleware({ query: QuerySchema });
    app.post('/body', bodyMiddleware, (req, res) => res.json({ name: req.body.name }));
    app.get('/query', queryMiddleware, (req, res) => res.json({ page: req.query.page }));
    app.use(errorMiddleware);
  });

  it('passes valid body and mutates req.body with parsed data', async () => {
    const res = await request(app).post('/body').send({ name: 'Rex', age: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Rex' });
  });

  it('rejects invalid body with 400 and field-level message', async () => {
    const res = await request(app).post('/body').send({ age: 'not-a-number' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  it('passes valid query and applies coerce transform', async () => {
    const res = await request(app).get('/query?page=3');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 3 });
  });

  it('uses default value when query param is missing', async () => {
    const res = await request(app).get('/query');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 1 });
  });
});
