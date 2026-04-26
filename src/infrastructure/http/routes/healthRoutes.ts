import { Router } from 'express';
import { Container } from 'typedi';
import { HealthController } from '../controllers/HealthController';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadImage } from '../middleware/upload';

export function healthRoutes(): Router {
  const router = Router();
  const controller = Container.get(HealthController);

  router.get('/:petId/vet-visits', authMiddleware, controller.getVetVisits.bind(controller));
  router.post('/:petId/vet-visits', authMiddleware, controller.createVetVisit.bind(controller));
  router.put('/:petId/vet-visits/:visitId', authMiddleware, controller.updateVetVisit.bind(controller));
  router.patch('/:petId/vet-visits/:visitId/complete', authMiddleware, controller.completeVetVisit.bind(controller));
  router.get('/:petId/vet-visits/:visitId/reminder', authMiddleware, controller.getVetVisitReminder.bind(controller));
  router.put('/:petId/vet-visits/:visitId/reminder', authMiddleware, controller.configureVetVisitReminder.bind(controller));
  router.post('/:petId/vet-visits/:visitId/images', authMiddleware, uploadImage.single('image'), controller.uploadVetVisitImage.bind(controller));
  router.get('/:petId/medications', authMiddleware, controller.getMedications.bind(controller));
  router.post('/:petId/medications', authMiddleware, controller.createMedication.bind(controller));
  router.put('/:petId/medications/:medicationId', authMiddleware, controller.updateMedication.bind(controller));

  return router;
}
