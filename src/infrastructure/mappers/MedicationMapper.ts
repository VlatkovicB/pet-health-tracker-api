import { Service } from 'typedi';
import { MedicationModel } from '../db/models/MedicationModel';
import { Medication } from '../../domain/health/Medication';
import { Dosage } from '../../domain/health/value-objects/Dosage';
import { FrequencySchedule, FrequencyType } from '../../domain/health/value-objects/FrequencySchedule';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface MedicationResponseDto {
  id: string;
  petId: string;
  name: string;
  dosage: { amount: number; unit: string };
  frequency: { type: FrequencyType; interval: number; label: string };
  startDate: string;
  endDate?: string;
  notes?: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
}

@Service()
export class MedicationMapper {
  toDomain(model: MedicationModel): Medication {
    return Medication.reconstitute(
      {
        petId: model.petId,
        name: model.name,
        dosage: Dosage.create(model.dosageAmount, model.dosageUnit as any),
        frequency: FrequencySchedule.create({ type: model.frequencyType as FrequencyType, interval: model.frequencyInterval }),
        startDate: model.startDate,
        endDate: model.endDate ?? undefined,
        notes: model.notes ?? undefined,
        active: model.active,
        createdBy: model.createdBy,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(medication: Medication): object {
    return {
      id: medication.id.toValue(),
      petId: medication.petId,
      name: medication.name,
      dosageAmount: medication.dosage.amount,
      dosageUnit: medication.dosage.unit,
      frequencyType: medication.frequency.type,
      frequencyInterval: medication.frequency.interval,
      startDate: medication.startDate,
      endDate: medication.endDate ?? null,
      notes: medication.notes ?? null,
      active: medication.active,
      createdBy: medication.createdBy,
      createdAt: medication.createdAt,
    };
  }

  toResponse(medication: Medication): MedicationResponseDto {
    return {
      id: medication.id.toValue(),
      petId: medication.petId,
      name: medication.name,
      dosage: {
        amount: medication.dosage.amount,
        unit: medication.dosage.unit,
      },
      frequency: {
        type: medication.frequency.type,
        interval: medication.frequency.interval,
        label: medication.frequency.toLabel(),
      },
      startDate: medication.startDate.toISOString(),
      endDate: medication.endDate?.toISOString(),
      notes: medication.notes,
      active: medication.active,
      createdBy: medication.createdBy,
      createdAt: medication.createdAt.toISOString(),
    };
  }
}
