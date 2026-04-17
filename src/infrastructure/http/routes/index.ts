import { Router } from 'express';
import { Container } from 'typedi';
import { authRoutes } from './authRoutes';
import { petRoutes } from './petRoutes';
import { healthRoutes } from './healthRoutes';
import { reminderRoutes } from './reminderRoutes';
import { vetRoutes } from './vetRoutes';
import { userRoutes } from './userRoutes';
import { placesRoutes } from './placesRoutes';
import { authMiddleware } from '../middleware/authMiddleware';
import { HealthController } from '../controllers/HealthController';

export function buildRouter(): Router {
  const router = Router();

  router.use('/auth', authRoutes());
  router.use('/users', userRoutes());
  router.use('/pets', petRoutes());
  router.use('/pets', healthRoutes());
  router.use('/vets', vetRoutes());
  router.use('/medications', reminderRoutes());
  router.use('/places', placesRoutes());
  router.get('/vet-visits/upcoming', authMiddleware, Container.get(HealthController).getUpcomingVetVisits);
  router.get('/vet-visits', authMiddleware, Container.get(HealthController).getVetVisitsByDateRange);

  return router;
}
