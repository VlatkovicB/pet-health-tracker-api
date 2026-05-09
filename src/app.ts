import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { useExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';
import passport from 'passport';
import { configurePassport } from './infrastructure/http/middleware/passportConfig';
import { oauthRoutes } from './infrastructure/http/routes/oauthRoutes';
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
import { WeightController } from './infrastructure/http/controllers/WeightController';
import { PhotoController } from './infrastructure/http/controllers/PhotoController';
import { AdminController } from './infrastructure/http/controllers/AdminController';

export function createApp(): express.Application {
  useContainer(Container);

  const app = express();

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });

  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: true }));
  app.use('/api/v1/auth', authLimiter);
  app.use(express.json());
  app.use(cookieParser());

  configurePassport();
  app.use(passport.initialize());
  app.use('/api/v1/auth', oauthRoutes());

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
      WeightController,
      PhotoController,
      AdminController,
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
