import { Router } from 'express';
import { Container } from 'typedi';
import { ReminderController } from '../controllers/ReminderController';
import { authMiddleware } from '../middleware/authMiddleware';

export function reminderRoutes(): Router {
  const router = Router();
  const controller = Container.get(ReminderController);

  router.get('/:medicationId/reminder', authMiddleware, controller.getReminder);
  router.put('/:medicationId/reminder', authMiddleware, controller.configure);
  router.patch('/:medicationId/reminder/toggle', authMiddleware, controller.toggle);

  return router;
}
