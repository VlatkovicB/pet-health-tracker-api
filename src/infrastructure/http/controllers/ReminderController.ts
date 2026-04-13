import { Request, Response, NextFunction } from 'express';
import { Inject, Service } from 'typedi';
import { ConfigureMedicationReminderUseCase } from '../../../application/reminder/ConfigureMedicationReminderUseCase';
import { ToggleMedicationReminderUseCase } from '../../../application/reminder/ToggleMedicationReminderUseCase';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../../domain/reminder/ReminderRepository';
import { ReminderMapper } from '../../mappers/ReminderMapper';

@Service()
export class ReminderController {
  constructor(
    private readonly configureReminder: ConfigureMedicationReminderUseCase,
    private readonly toggleReminder: ToggleMedicationReminderUseCase,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderMapper: ReminderMapper,
  ) {}

  getReminder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reminder = await this.reminderRepo.findByEntityId(req.params.medicationId);
      if (!reminder) { res.status(404).json({ message: 'No reminder configured' }); return; }
      res.json(this.reminderMapper.toResponse(reminder));
    } catch (err) {
      next(err);
    }
  };

  configure = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.configureReminder.execute({
        medicationId: req.params.medicationId,
        ...req.body,
        requestingUserId: req.auth.userId,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  toggle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.toggleReminder.execute(
        req.params.medicationId,
        req.body.enabled,
        req.auth.userId,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
