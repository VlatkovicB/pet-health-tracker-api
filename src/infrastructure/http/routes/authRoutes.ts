import { Router } from 'express';
import { Container } from 'typedi';
import { AuthController } from '../controllers/AuthController';

export function authRoutes(): Router {
  const router = Router();
  const controller = Container.get(AuthController);

  router.post('/register', controller.register);
  router.post('/login', controller.login);

  return router;
}
