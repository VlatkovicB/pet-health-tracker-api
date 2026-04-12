import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';
import { ReminderSchedule } from '../health/value-objects/ReminderSchedule';

export type ReminderEntityType = 'medication' | 'vet_visit';

interface ReminderProps {
  entityType: ReminderEntityType;
  entityId: string;
  schedule: ReminderSchedule;
  enabled: boolean;
  notifyUserIds: string[];
  createdBy: string;
  createdAt: Date;
}

export class Reminder extends Entity<ReminderProps> {
  get entityType(): ReminderEntityType { return this.props.entityType; }
  get entityId(): string { return this.props.entityId; }
  get schedule(): ReminderSchedule { return this.props.schedule; }
  get enabled(): boolean { return this.props.enabled; }
  get notifyUserIds(): string[] { return this.props.notifyUserIds; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }

  toggle(enabled: boolean): void {
    this.props.enabled = enabled;
  }

  updateSchedule(schedule: ReminderSchedule): void {
    this.props.schedule = schedule;
  }

  static create(
    props: Omit<ReminderProps, 'createdAt'>,
    id?: UniqueEntityId,
  ): Reminder {
    return new Reminder({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: ReminderProps, id: UniqueEntityId): Reminder {
    return new Reminder(props, id);
  }
}
