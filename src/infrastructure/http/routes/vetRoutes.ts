import { Router } from 'express';
import { Container } from 'typedi';
import { VetController } from '../controllers/VetController';
import { authMiddleware } from '../middleware/authMiddleware';

export function vetRoutes(): Router {
  const router = Router({ mergeParams: true });
  const controller = Container.get(VetController);

  router.get('/', authMiddleware, controller.list);
  router.post('/', authMiddleware, controller.create);

  return router;
}
