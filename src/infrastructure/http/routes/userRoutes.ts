import { Router } from 'express';
import { Container } from 'typedi';
import { UserController } from '../controllers/UserController';
import { authMiddleware } from '../middleware/authMiddleware';

export function userRoutes(): Router {
  const router = Router();
  const controller = Container.get(UserController);

  router.get('/me', authMiddleware, controller.getMe);
  router.patch('/me', authMiddleware, controller.updateTheme);

  return router;
}
