import { Router } from 'express';
import { Container } from 'typedi';
import { ShareController } from '../controllers/ShareController';
import { authMiddleware } from '../middleware/authMiddleware';

export function shareRoutes(): Router {
  const router = Router();
  const controller = Container.get(ShareController);

  router.get('/shared-with-me', authMiddleware, controller.listSharedWithMe.bind(controller));
  router.get('/:petId/shares', authMiddleware, controller.listForPet.bind(controller));
  router.post('/:petId/shares', authMiddleware, controller.create.bind(controller));
  router.put('/:petId/shares/:shareId', authMiddleware, controller.update.bind(controller));
  router.delete('/:petId/shares/:shareId', authMiddleware, controller.revoke.bind(controller));

  return router;
}
