import { Router } from 'express';
import { Container } from 'typedi';
import { authRoutes } from './authRoutes';
import { groupRoutes } from './groupRoutes';
import { petRoutes } from './petRoutes';
import { healthRoutes } from './healthRoutes';
import { reminderRoutes } from './reminderRoutes';
import { vetRoutes } from './vetRoutes';

export function buildRouter(): Router {
  const router = Router();

  router.use('/auth', authRoutes());
  router.use('/groups', groupRoutes());
  router.use('/groups', petRoutes());
  router.use('/groups/:groupId/vets', vetRoutes());
  router.use('/pets', healthRoutes());
  router.use('/medications', reminderRoutes());

  return router;
}
