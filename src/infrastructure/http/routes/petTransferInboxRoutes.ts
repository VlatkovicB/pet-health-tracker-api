import { Router } from 'express';
import { Container } from 'typedi';
import { TransferController } from '../controllers/TransferController';
import { authMiddleware } from '../middleware/authMiddleware';

export function petTransferInboxRoutes(): Router {
  const router = Router();
  const controller = Container.get(TransferController);

  router.get('/pending', authMiddleware, controller.listPending);
  router.patch('/:transferId/accept', authMiddleware, controller.accept);
  router.patch('/:transferId/decline', authMiddleware, controller.decline);

  return router;
}
