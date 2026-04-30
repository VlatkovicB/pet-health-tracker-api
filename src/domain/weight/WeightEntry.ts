import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export type WeightUnit = 'kg' | 'lb';

interface WeightEntryProps {
  petId: string;
  date: string; // 'YYYY-MM-DD'
  value: number;
  unit: WeightUnit;
  notes?: string;
  createdAt: Date;
}

export class WeightEntry extends Entity<WeightEntryProps> {
  get petId(): string { return this.props.petId; }
  get date(): string { return this.props.date; }
  get value(): number { return this.props.value; }
  get unit(): WeightUnit { return this.props.unit; }
  get notes(): string | undefined { return this.props.notes; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<WeightEntryProps, 'createdAt'>, id?: UniqueEntityId): WeightEntry {
    return new WeightEntry({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: WeightEntryProps, id: UniqueEntityId): WeightEntry {
    return new WeightEntry(props, id);
  }
}
