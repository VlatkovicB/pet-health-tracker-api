import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

interface VetProps {
  userId: string;
  name: string;
  address?: string;
  phone?: string;
  workHours?: string;
  googleMapsUrl?: string;
  notes?: string;
  createdAt: Date;
}

export class Vet extends Entity<VetProps> {
  get userId(): string { return this.props.userId; }
  get name(): string { return this.props.name; }
  get address(): string | undefined { return this.props.address; }
  get phone(): string | undefined { return this.props.phone; }
  get workHours(): string | undefined { return this.props.workHours; }
  get googleMapsUrl(): string | undefined { return this.props.googleMapsUrl; }
  get notes(): string | undefined { return this.props.notes; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<VetProps, 'createdAt'>, id?: UniqueEntityId): Vet {
    return new Vet({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: VetProps, id: UniqueEntityId): Vet {
    return new Vet(props, id);
  }
}
