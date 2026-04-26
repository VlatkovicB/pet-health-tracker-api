import { Router } from 'express';
import { Container } from 'typedi';
import { PlacesController } from '../controllers/PlacesController';
import { authMiddleware } from '../middleware/authMiddleware';

export function placesRoutes(): Router {
  const router = Router();
  const controller = Container.get(PlacesController);

  router.get('/search', authMiddleware, controller.search.bind(controller));
  router.get('/details', authMiddleware, controller.details.bind(controller));

  return router;
}
