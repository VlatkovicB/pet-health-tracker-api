import { Router } from 'express';
import { Container } from 'typedi';
import { authRoutes } from './authRoutes';
import { petRoutes } from './petRoutes';
import { healthRoutes } from './healthRoutes';
import { reminderRoutes } from './reminderRoutes';
import { vetRoutes } from './vetRoutes';
import { userRoutes } from './userRoutes';
import { placesRoutes } from './placesRoutes';
import { noteRoutes } from './noteRoutes';
import { shareRoutes } from './shareRoutes';
import { petShareInboxRoutes } from './petShareInboxRoutes';
import { transferRoutes } from './transferRoutes';
import { petTransferInboxRoutes } from './petTransferInboxRoutes';
import { authMiddleware } from '../middleware/authMiddleware';
import { VetVisitController } from '../controllers/VetVisitController';

export function buildRouter(): Router {
  const router = Router();

  router.use('/auth', authRoutes());
  router.use('/users', userRoutes());
  router.use('/pets', shareRoutes());
  router.use('/pets', transferRoutes());
  router.use('/pets', petRoutes());
  router.use('/pets', healthRoutes());
  router.use('/vets', vetRoutes());
  router.use('/medications', reminderRoutes());
  router.use('/places', placesRoutes());
  router.use('/notes', noteRoutes());
  router.use('/pet-shares', petShareInboxRoutes());
  router.use('/pet-ownership-transfers', petTransferInboxRoutes());
  router.get('/vet-visits/upcoming', authMiddleware, Container.get(VetVisitController).getUpcoming.bind(Container.get(VetVisitController)));
  router.get('/vet-visits', authMiddleware, Container.get(VetVisitController).getByDateRange.bind(Container.get(VetVisitController)));

  return router;
}
