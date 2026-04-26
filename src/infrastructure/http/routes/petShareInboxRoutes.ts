import { Router } from 'express';
import { Container } from 'typedi';
import { PetShareInboxController } from '../controllers/PetShareInboxController';
import { authMiddleware } from '../middleware/authMiddleware';

export function petShareInboxRoutes(): Router {
  const router = Router();
  const controller = Container.get(PetShareInboxController);

  router.get('/pending', authMiddleware, controller.listPending.bind(controller));
  router.patch('/:shareId/accept', authMiddleware, controller.accept.bind(controller));
  router.patch('/:shareId/decline', authMiddleware, controller.decline.bind(controller));

  return router;
}
