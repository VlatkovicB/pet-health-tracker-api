import { Router } from 'express';
import { Container } from 'typedi';
import { GroupController } from '../controllers/GroupController';
import { authMiddleware } from '../middleware/authMiddleware';

export function groupRoutes(): Router {
  const router = Router();
  const controller = Container.get(GroupController);

  router.get('/', authMiddleware, controller.list);
  router.post('/', authMiddleware, controller.create);
  router.post('/:groupId/invite', authMiddleware, controller.invite);

  return router;
}
