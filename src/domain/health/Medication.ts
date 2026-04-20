import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';
import { Dosage } from './value-objects/Dosage';
import { ReminderSchedule } from './value-objects/ReminderSchedule';

interface MedicationProps {
  petId: string;
  name: string;
  dosage: Dosage;
  schedule: ReminderSchedule;
  startDate: Date;
  endDate?: Date;
  notes?: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
}

export class Medication extends Entity<MedicationProps> {
  get petId(): string { return this.props.petId; }
  get name(): string { return this.props.name; }
  get dosage(): Dosage { return this.props.dosage; }
  get schedule(): ReminderSchedule { return this.props.schedule; }
  get startDate(): Date { return this.props.startDate; }
  get endDate(): Date | undefined { return this.props.endDate; }
  get notes(): string | undefined { return this.props.notes; }
  get active(): boolean { return this.props.active; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<MedicationProps, 'createdAt'>, id?: UniqueEntityId): Medication {
    return new Medication({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: MedicationProps, id: UniqueEntityId): Medication {
    return new Medication(props, id);
  }
}
