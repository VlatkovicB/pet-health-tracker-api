import { Router } from 'express';
import { Container } from 'typedi';
import { HealthController } from '../controllers/HealthController';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadImage } from '../middleware/upload';

export function healthRoutes(): Router {
  const router = Router();
  const controller = Container.get(HealthController);

  router.get('/:petId/vet-visits', authMiddleware, controller.getVetVisits);
  router.post('/:petId/vet-visits', authMiddleware, controller.createVetVisit);
  router.put('/:petId/vet-visits/:visitId', authMiddleware, controller.updateVetVisitHandler);
  router.post('/:petId/vet-visits/:visitId/images', authMiddleware, uploadImage.single('image'), controller.uploadVetVisitImage);
  router.get('/:petId/medications', authMiddleware, controller.getMedications);
  router.post('/:petId/medications', authMiddleware, controller.createMedication);
  router.get('/:petId/symptoms', authMiddleware, controller.getSymptoms);
  router.post('/:petId/symptoms', authMiddleware, controller.createSymptom);
  router.get('/:petId/health-checks', authMiddleware, controller.getHealthChecks);
  router.post('/:petId/health-checks', authMiddleware, controller.createHealthCheck);

  return router;
}
