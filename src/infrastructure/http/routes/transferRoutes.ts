import { Router } from 'express';
import { Container } from 'typedi';
import { TransferController } from '../controllers/TransferController';
import { authMiddleware } from '../middleware/authMiddleware';

export function transferRoutes(): Router {
  const router = Router();
  const controller = Container.get(TransferController);

  router.post('/:petId/transfer', authMiddleware, controller.initiate);
  router.delete('/:petId/transfer', authMiddleware, controller.cancel);

  return router;
}
