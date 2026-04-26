import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { useExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';
import { errorMiddleware } from './infrastructure/http/middleware/errorMiddleware';
import { devRoutes } from './infrastructure/http/routes/devRoutes';

import { AuthController } from './infrastructure/http/controllers/AuthController';
import { UserController } from './infrastructure/http/controllers/UserController';
import { ShareController } from './infrastructure/http/controllers/ShareController';
import { TransferController } from './infrastructure/http/controllers/TransferController';
import { PetController } from './infrastructure/http/controllers/PetController';
import { VetController } from './infrastructure/http/controllers/VetController';
import { HealthController } from './infrastructure/http/controllers/HealthController';
import { VetVisitController } from './infrastructure/http/controllers/VetVisitController';
import { ReminderController } from './infrastructure/http/controllers/ReminderController';
import { NoteController } from './infrastructure/http/controllers/NoteController';
import { PetShareInboxController } from './infrastructure/http/controllers/PetShareInboxController';
import { PetTransferInboxController } from './infrastructure/http/controllers/PetTransferInboxController';
import { PlacesController } from './infrastructure/http/controllers/PlacesController';

export function createApp(): express.Application {
  useContainer(Container);

  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  useExpressServer(app, {
    routePrefix: '/api/v1',
    controllers: [
      AuthController,
      UserController,
      ShareController,
      TransferController,
      PetController,
      VetController,
      HealthController,
      VetVisitController,
      ReminderController,
      NoteController,
      PetShareInboxController,
      PetTransferInboxController,
      PlacesController,
    ],
    defaultErrorHandler: false,
    currentUserChecker: (action) => action.request.auth,
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/v1/dev', devRoutes());
  }

  app.use(errorMiddleware);

  return app;
}
