import { Router } from 'express';
import { Container } from 'typedi';
import { ShareController } from '../controllers/ShareController';
import { authMiddleware } from '../middleware/authMiddleware';

export function shareRoutes(): Router {
  const router = Router();
  const controller = Container.get(ShareController);

  router.get('/shared-with-me', authMiddleware, controller.listSharedWithMe);
  router.get('/:petId/shares', authMiddleware, controller.listForPet);
  router.post('/:petId/shares', authMiddleware, controller.create);
  router.put('/:petId/shares/:shareId', authMiddleware, controller.update);
  router.delete('/:petId/shares/:shareId', authMiddleware, controller.revoke);

  return router;
}
