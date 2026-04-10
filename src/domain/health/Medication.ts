import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';
import { Dosage } from './value-objects/Dosage';
import { ReminderSchedule } from './value-objects/ReminderSchedule';

export interface MedicationReminder {
  schedule: ReminderSchedule;
  enabled: boolean;
  notifyUserIds: string[];
}

interface MedicationProps {
  petId: string;
  name: string;
  dosage: Dosage;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  notes?: string;
  active: boolean;
  reminder?: MedicationReminder;
  createdBy: string;
  createdAt: Date;
}

export class Medication extends Entity<MedicationProps> {
  get petId(): string { return this.props.petId; }
  get name(): string { return this.props.name; }
  get dosage(): Dosage { return this.props.dosage; }
  get frequency(): string { return this.props.frequency; }
  get startDate(): Date { return this.props.startDate; }
  get endDate(): Date | undefined { return this.props.endDate; }
  get notes(): string | undefined { return this.props.notes; }
  get active(): boolean { return this.props.active; }
  get reminder(): MedicationReminder | undefined { return this.props.reminder; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }

  configureReminder(reminder: MedicationReminder): void {
    this.props.reminder = reminder;
  }

  toggleReminder(enabled: boolean): void {
    if (!this.props.reminder) throw new Error('No reminder configured for this medication');
    this.props.reminder = { ...this.props.reminder, enabled };
  }

  static create(props: Omit<MedicationProps, 'createdAt'>, id?: UniqueEntityId): Medication {
    return new Medication({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: MedicationProps, id: UniqueEntityId): Medication {
    return new Medication(props, id);
  }
}
