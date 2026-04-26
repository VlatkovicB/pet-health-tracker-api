import { JsonController, Get, Put, Patch, Body, Param, UseBefore, CurrentUser, OnUndefined } from 'routing-controllers';
import { Inject, Service } from 'typedi';
import { ConfigureMedicationReminderUseCase } from '../../../application/reminder/ConfigureMedicationReminderUseCase';
import { ToggleMedicationReminderUseCase } from '../../../application/reminder/ToggleMedicationReminderUseCase';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../../domain/reminder/ReminderRepository';
import { ReminderMapper } from '../../mappers/ReminderMapper';
import { NotFoundError } from '../../../shared/errors/AppError';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { ConfigureReminderSchema, ConfigureReminderBody, ToggleReminderSchema, ToggleReminderBody } from '../schemas/reminderSchemas';

@JsonController('/medications')
@Service()
@UseBefore(authMiddleware)
export class ReminderController {
  constructor(
    private readonly configureReminder: ConfigureMedicationReminderUseCase,
    private readonly toggleReminder: ToggleMedicationReminderUseCase,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
    private readonly reminderMapper: ReminderMapper,
  ) {}

  @Get('/:medicationId/reminder')
  async getReminder(@Param('medicationId') medicationId: string) {
    const reminder = await this.reminderRepo.findByEntityId(medicationId);
    if (!reminder) throw new NotFoundError('Reminder');
    return this.reminderMapper.toResponse(reminder);
  }

  @Put('/:medicationId/reminder')
  @OnUndefined(204)
  @Validate({ body: ConfigureReminderSchema })
  async configure(@Param('medicationId') medicationId: string, @Body() body: ConfigureReminderBody, @CurrentUser() user: AuthPayload) {
    await this.configureReminder.execute({ medicationId, ...body, requestingUserId: user.userId });
  }

  @Patch('/:medicationId/reminder/toggle')
  @OnUndefined(204)
  @Validate({ body: ToggleReminderSchema })
  async toggle(@Param('medicationId') medicationId: string, @Body() body: ToggleReminderBody, @CurrentUser() user: AuthPayload) {
    await this.toggleReminder.execute(medicationId, body.enabled, user.userId);
  }
}
