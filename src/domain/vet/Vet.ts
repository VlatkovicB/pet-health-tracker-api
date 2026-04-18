import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';
import type { DayOfWeek } from '../health/value-objects/ReminderSchedule';

export interface VetWorkHoursProps {
  dayOfWeek: DayOfWeek;
  open: boolean;
  startTime?: string;
  endTime?: string;
}

interface VetProps {
  userId: string;
  name: string;
  address?: string;
  phone?: string;
  workHours?: VetWorkHoursProps[];
  googleMapsUrl?: string;
  rating?: number;
  placeId?: string;
  notes?: string;
  createdAt: Date;
}

export class Vet extends Entity<VetProps> {
  get userId(): string { return this.props.userId; }
  get name(): string { return this.props.name; }
  get address(): string | undefined { return this.props.address; }
  get phone(): string | undefined { return this.props.phone; }
  get workHours(): VetWorkHoursProps[] | undefined { return this.props.workHours; }
  get googleMapsUrl(): string | undefined { return this.props.googleMapsUrl; }
  get rating(): number | undefined { return this.props.rating; }
  get placeId(): string | undefined { return this.props.placeId; }
  get notes(): string | undefined { return this.props.notes; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<VetProps, 'createdAt'>, id?: UniqueEntityId): Vet {
    return new Vet({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: VetProps, id: UniqueEntityId): Vet {
    return new Vet(props, id);
  }
}
