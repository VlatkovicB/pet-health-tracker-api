import { Router } from 'express';
import { Container } from 'typedi';
import { PetController } from '../controllers/PetController';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadPetPhoto } from '../middleware/upload';

export function petRoutes(): Router {
  const router = Router();
  const controller = Container.get(PetController);

  router.get('/:groupId/pets', authMiddleware, controller.list);
  router.post('/:groupId/pets', authMiddleware, controller.create);
  router.get('/:groupId/pets/:petId', authMiddleware, controller.get);
  router.put('/:groupId/pets/:petId', authMiddleware, controller.update);
  router.post('/:groupId/pets/:petId/photo', authMiddleware, uploadPetPhoto.single('photo'), controller.uploadPhoto);

  return router;
}
