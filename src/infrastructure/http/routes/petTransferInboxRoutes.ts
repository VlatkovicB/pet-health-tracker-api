import { Router } from 'express';
import { Container } from 'typedi';
import { PetTransferInboxController } from '../controllers/PetTransferInboxController';
import { authMiddleware } from '../middleware/authMiddleware';

export function petTransferInboxRoutes(): Router {
  const router = Router();
  const controller = Container.get(PetTransferInboxController);

  router.get('/pending', authMiddleware, controller.listPending.bind(controller));
  router.patch('/:transferId/accept', authMiddleware, controller.accept.bind(controller));
  router.patch('/:transferId/decline', authMiddleware, controller.decline.bind(controller));

  return router;
}
