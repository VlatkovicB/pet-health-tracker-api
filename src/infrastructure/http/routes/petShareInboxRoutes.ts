import { Router } from 'express';
import { Container } from 'typedi';
import { ShareController } from '../controllers/ShareController';
import { authMiddleware } from '../middleware/authMiddleware';

export function petShareInboxRoutes(): Router {
  const router = Router();
  const controller = Container.get(ShareController);

  router.get('/pending', authMiddleware, controller.listPending);
  router.patch('/:shareId/accept', authMiddleware, controller.accept);
  router.patch('/:shareId/decline', authMiddleware, controller.decline);

  return router;
}
