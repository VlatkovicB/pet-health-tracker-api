import { Service } from 'typedi';
import { HealthCheckModel } from '../db/models/HealthCheckModel';
import { HealthCheck } from '../../domain/health/HealthCheck';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface HealthCheckResponseDto {
  id: string;
  petId: string;
  weightKg?: number;
  temperatureC?: number;
  notes?: string;
  checkedAt: string;
  createdBy: string;
  createdAt: string;
}

@Service()
export class HealthCheckMapper {
  toDomain(model: HealthCheckModel): HealthCheck {
    return HealthCheck.reconstitute(
      {
        petId: model.petId,
        weightKg: model.weightKg ?? undefined,
        temperatureC: model.temperatureC ?? undefined,
        notes: model.notes ?? undefined,
        checkedAt: model.checkedAt,
        createdBy: model.createdBy,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(check: HealthCheck): object {
    return {
      id: check.id.toValue(),
      petId: check.petId,
      weightKg: check.weightKg ?? null,
      temperatureC: check.temperatureC ?? null,
      notes: check.notes ?? null,
      checkedAt: check.checkedAt,
      createdBy: check.createdBy,
      createdAt: check.createdAt,
    };
  }

  toResponse(check: HealthCheck): HealthCheckResponseDto {
    return {
      id: check.id.toValue(),
      petId: check.petId,
      weightKg: check.weightKg,
      temperatureC: check.temperatureC,
      notes: check.notes,
      checkedAt: check.checkedAt.toISOString(),
      createdBy: check.createdBy,
      createdAt: check.createdAt.toISOString(),
    };
  }
}
