import { Service } from 'typedi';
import { WeightEntry, WeightUnit } from '../../domain/weight/WeightEntry';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';
import { WeightEntryModel } from '../db/models/WeightEntryModel';

export interface WeightEntryResponseDto {
  id: string;
  petId: string;
  date: string;
  value: number;
  unit: WeightUnit;
  notes?: string;
  createdAt: string;
}

@Service()
export class WeightEntryMapper {
  toDomain(model: WeightEntryModel): WeightEntry {
    return WeightEntry.reconstitute(
      {
        petId: model.petId,
        date: model.date,
        value: Number(model.value),
        unit: model.unit as WeightUnit,
        notes: model.notes ?? undefined,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(entry: WeightEntry): object {
    return {
      id: entry.id.toValue(),
      petId: entry.petId,
      date: entry.date,
      value: entry.value,
      unit: entry.unit,
      notes: entry.notes ?? null,
      createdAt: entry.createdAt,
    };
  }

  toResponse(entry: WeightEntry): WeightEntryResponseDto {
    return {
      id: entry.id.toValue(),
      petId: entry.petId,
      date: entry.date,
      value: entry.value,
      unit: entry.unit,
      notes: entry.notes,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
