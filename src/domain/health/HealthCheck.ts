import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

interface HealthCheckProps {
  petId: string;
  weightKg?: number;
  temperatureC?: number;
  notes?: string;
  checkedAt: Date;
  createdBy: string;
  createdAt: Date;
}

export class HealthCheck extends Entity<HealthCheckProps> {
  get petId(): string { return this.props.petId; }
  get weightKg(): number | undefined { return this.props.weightKg; }
  get temperatureC(): number | undefined { return this.props.temperatureC; }
  get notes(): string | undefined { return this.props.notes; }
  get checkedAt(): Date { return this.props.checkedAt; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<HealthCheckProps, 'createdAt'>, id?: UniqueEntityId): HealthCheck {
    return new HealthCheck({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: HealthCheckProps, id: UniqueEntityId): HealthCheck {
    return new HealthCheck(props, id);
  }
}
