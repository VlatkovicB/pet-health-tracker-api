import { Service } from 'typedi';
import { ReminderModel } from '../db/models/ReminderModel';
import { Reminder, ReminderEntityType, AdvanceNotice } from '../../domain/reminder/Reminder';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface ReminderResponseDto {
  id: string;
  entityType: ReminderEntityType;
  entityId: string;
  schedule: ReminderScheduleProps;
  enabled: boolean;
  advanceNotice?: AdvanceNotice;
  notifyUserIds: string[];
  createdAt: string;
}

@Service()
export class ReminderMapper {
  toDomain(model: ReminderModel): Reminder {
    return Reminder.reconstitute(
      {
        entityType: model.entityType as ReminderEntityType,
        entityId: model.entityId,
        schedule: ReminderSchedule.create(model.schedule),
        enabled: model.enabled,
        advanceNotice: model.advanceNotice ?? undefined,
        notifyUserIds: (model.notifyUsers ?? []).map((r) => r.userId),
        createdBy: model.createdBy,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(reminder: Reminder): object {
    return {
      id: reminder.id.toValue(),
      entityType: reminder.entityType,
      entityId: reminder.entityId,
      schedule: reminder.schedule.toJSON(),
      enabled: reminder.enabled,
      advanceNotice: reminder.advanceNotice ?? null,
      createdBy: reminder.createdBy,
      createdAt: reminder.createdAt,
    };
  }

  toResponse(reminder: Reminder): ReminderResponseDto {
    return {
      id: reminder.id.toValue(),
      entityType: reminder.entityType,
      entityId: reminder.entityId,
      schedule: reminder.schedule.toJSON(),
      enabled: reminder.enabled,
      advanceNotice: reminder.advanceNotice,
      notifyUserIds: reminder.notifyUserIds,
      createdAt: reminder.createdAt.toISOString(),
    };
  }
}
