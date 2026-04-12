import express from 'express';
import cors from 'cors';
import path from 'path';
import { buildRouter } from './infrastructure/http/routes';
import { devRoutes } from './infrastructure/http/routes/devRoutes';
import { errorMiddleware } from './infrastructure/http/middleware/errorMiddleware';

export function createApp(): express.Application {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/v1', buildRouter());

  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/v1/dev', devRoutes());
  }

  app.use(errorMiddleware);

  return app;
}
