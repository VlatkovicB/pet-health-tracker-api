import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';
import { Severity } from './value-objects/Severity';

interface SymptomProps {
  petId: string;
  description: string;
  severity: Severity;
  observedAt: Date;
  notes?: string;
  resolvedAt?: Date;
  createdBy: string;
  createdAt: Date;
}

export class Symptom extends Entity<SymptomProps> {
  get petId(): string { return this.props.petId; }
  get description(): string { return this.props.description; }
  get severity(): Severity { return this.props.severity; }
  get observedAt(): Date { return this.props.observedAt; }
  get notes(): string | undefined { return this.props.notes; }
  get resolvedAt(): Date | undefined { return this.props.resolvedAt; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }

  resolve(resolvedAt: Date = new Date()): void {
    this.props.resolvedAt = resolvedAt;
  }

  static create(props: Omit<SymptomProps, 'createdAt'>, id?: UniqueEntityId): Symptom {
    return new Symptom({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: SymptomProps, id: UniqueEntityId): Symptom {
    return new Symptom(props, id);
  }
}
