import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { ConfigureMedicationReminderUseCase } from '../../../application/reminder/ConfigureMedicationReminderUseCase';
import { ToggleMedicationReminderUseCase } from '../../../application/reminder/ToggleMedicationReminderUseCase';

@Service()
export class ReminderController {
  constructor(
    private readonly configureReminder: ConfigureMedicationReminderUseCase,
    private readonly toggleReminder: ToggleMedicationReminderUseCase,
  ) {}

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
