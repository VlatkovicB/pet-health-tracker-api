import { Router } from 'express';
import { Container } from 'typedi';
import { NoteController } from '../controllers/NoteController';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadNoteImage } from '../middleware/upload';

export function noteRoutes(): Router {
  const router = Router();
  const controller = Container.get(NoteController);

  router.post('/', authMiddleware, controller.create);
  router.get('/', authMiddleware, controller.list);
  router.put('/:noteId', authMiddleware, controller.update);
  router.delete('/:noteId', authMiddleware, controller.delete);
  router.post('/:noteId/images', authMiddleware, uploadNoteImage.single('image'), controller.addImage);

  return router;
}
