import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export type VetVisitType = 'logged' | 'scheduled';

interface VetVisitProps {
  petId: string;
  type: VetVisitType;
  vetId?: string;
  visitDate: Date;
  clinic?: string;
  vetName?: string;
  reason: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

export class VetVisit extends Entity<VetVisitProps> {
  get type(): VetVisitType { return this.props.type; }
  get petId(): string { return this.props.petId; }
  get vetId(): string | undefined { return this.props.vetId; }
  get visitDate(): Date { return this.props.visitDate; }
  get clinic(): string | undefined { return this.props.clinic; }
  get vetName(): string | undefined { return this.props.vetName; }
  get reason(): string { return this.props.reason; }
  get notes(): string | undefined { return this.props.notes; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<VetVisitProps, 'createdAt'>, id?: UniqueEntityId): VetVisit {
    return new VetVisit({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: VetVisitProps, id: UniqueEntityId): VetVisit {
    return new VetVisit(props, id);
  }
}
