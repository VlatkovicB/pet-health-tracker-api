import { AggregateRoot } from '../shared/AggregateRoot';
import { UniqueEntityId } from '../shared/UniqueEntityId';

interface PetProps {
  name: string;
  species: string;
  breed?: string;
  birthDate?: Date;
  userId: string;
  photoUrl?: string;
  color?: string;
  createdAt: Date;
}

export class Pet extends AggregateRoot<PetProps> {
  get name(): string { return this.props.name; }
  get species(): string { return this.props.species; }
  get breed(): string | undefined { return this.props.breed; }
  get birthDate(): Date | undefined { return this.props.birthDate; }
  get userId(): string { return this.props.userId; }
  get photoUrl(): string | undefined { return this.props.photoUrl; }
  get color(): string | undefined { return this.props.color; }
  get createdAt(): Date { return this.props.createdAt; }

  transferOwnership(newOwnerId: string): void {
    this.props.userId = newOwnerId;
  }

  static create(props: Omit<PetProps, 'createdAt'>, id?: UniqueEntityId): Pet {
    return new Pet({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: PetProps, id: UniqueEntityId): Pet {
    return new Pet(props, id);
  }
}
