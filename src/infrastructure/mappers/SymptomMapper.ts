import { Service } from 'typedi';
import { SymptomModel } from '../db/models/SymptomModel';
import { Symptom } from '../../domain/health/Symptom';
import { Severity, SeverityLevel } from '../../domain/health/value-objects/Severity';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface SymptomResponseDto {
  id: string;
  petId: string;
  description: string;
  severity: SeverityLevel;
  observedAt: string;
  notes?: string;
  resolvedAt?: string;
  createdBy: string;
  createdAt: string;
}

@Service()
export class SymptomMapper {
  toDomain(model: SymptomModel): Symptom {
    return Symptom.reconstitute(
      {
        petId: model.petId,
        description: model.description,
        severity: Severity.create(model.severity as SeverityLevel),
        observedAt: model.observedAt,
        notes: model.notes ?? undefined,
        resolvedAt: model.resolvedAt ?? undefined,
        createdBy: model.createdBy,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(symptom: Symptom): object {
    return {
      id: symptom.id.toValue(),
      petId: symptom.petId,
      description: symptom.description,
      severity: symptom.severity.level,
      observedAt: symptom.observedAt,
      notes: symptom.notes ?? null,
      resolvedAt: symptom.resolvedAt ?? null,
      createdBy: symptom.createdBy,
      createdAt: symptom.createdAt,
    };
  }

  toResponse(symptom: Symptom): SymptomResponseDto {
    return {
      id: symptom.id.toValue(),
      petId: symptom.petId,
      description: symptom.description,
      severity: symptom.severity.level,
      observedAt: symptom.observedAt.toISOString(),
      notes: symptom.notes,
      resolvedAt: symptom.resolvedAt?.toISOString(),
      createdBy: symptom.createdBy,
      createdAt: symptom.createdAt.toISOString(),
    };
  }
}
