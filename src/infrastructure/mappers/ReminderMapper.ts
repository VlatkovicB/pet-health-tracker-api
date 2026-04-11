import { Service } from 'typedi';
import { ReminderModel } from '../db/models/ReminderModel';
import { Reminder, ReminderEntityType } from '../../domain/reminder/Reminder';
import { FrequencySchedule, FrequencyType } from '../../domain/health/value-objects/FrequencySchedule';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface ReminderResponseDto {
  id: string;
  entityType: ReminderEntityType;
  entityId: string;
  schedule: { type: FrequencyType; interval: number; label: string };
  enabled: boolean;
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
        schedule: FrequencySchedule.create({
          type: model.scheduleType as FrequencyType,
          interval: model.scheduleInterval,
        }),
        enabled: model.enabled,
        notifyUserIds: (model.notifyUsers ?? []).map((r) => r.userId),
        createdBy: model.createdBy,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  /** Returns only the reminder row fields — notify users are persisted separately by the repository. */
  toPersistence(reminder: Reminder): object {
    return {
      id: reminder.id.toValue(),
      entityType: reminder.entityType,
      entityId: reminder.entityId,
      scheduleType: reminder.schedule.type,
      scheduleInterval: reminder.schedule.interval,
      enabled: reminder.enabled,
      createdBy: reminder.createdBy,
      createdAt: reminder.createdAt,
    };
  }

  toResponse(reminder: Reminder): ReminderResponseDto {
    return {
      id: reminder.id.toValue(),
      entityType: reminder.entityType,
      entityId: reminder.entityId,
      schedule: {
        type: reminder.schedule.type,
        interval: reminder.schedule.interval,
        label: reminder.schedule.toLabel(),
      },
      enabled: reminder.enabled,
      notifyUserIds: reminder.notifyUserIds,
      createdAt: reminder.createdAt.toISOString(),
    };
  }
}
