import { Router } from 'express';
import { Container } from 'typedi';
import { TransferController } from '../controllers/TransferController';
import { authMiddleware } from '../middleware/authMiddleware';

export function transferRoutes(): Router {
  const router = Router();
  const controller = Container.get(TransferController);

  router.post('/:petId/transfer', authMiddleware, controller.initiate.bind(controller));
  router.delete('/:petId/transfer', authMiddleware, controller.cancel.bind(controller));

  return router;
}
