import { Router } from 'express';
import { Container } from 'typedi';
import { PetController } from '../controllers/PetController';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadPetPhoto } from '../middleware/upload';

export function petRoutes(): Router {
  const router = Router();
  const controller = Container.get(PetController);

  router.get('/', authMiddleware, controller.list);
  router.post('/', authMiddleware, controller.create);
  router.get('/:petId', authMiddleware, controller.get);
  router.put('/:petId', authMiddleware, controller.update);
  router.post('/:petId/photo', authMiddleware, uploadPetPhoto.single('photo'), controller.uploadPhoto);

  return router;
}
