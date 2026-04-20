import { Service } from 'typedi';
import { MedicationModel } from '../db/models/MedicationModel';
import { Medication } from '../../domain/health/Medication';
import { Dosage } from '../../domain/health/value-objects/Dosage';
import { ReminderSchedule, ReminderScheduleProps } from '../../domain/health/value-objects/ReminderSchedule';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';
import type { AdvanceNotice } from '../../domain/reminder/Reminder';

export interface MedicationResponseDto {
  id: string;
  petId: string;
  name: string;
  dosage: { amount: number; unit: string };
  schedule: ReminderScheduleProps;
  startDate: string;
  endDate?: string;
  notes?: string;
  active: boolean;
  reminderEnabled: boolean;
  advanceNotice?: AdvanceNotice;
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
        schedule: ReminderSchedule.create(model.schedule),
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
      schedule: medication.schedule.toJSON(),
      startDate: medication.startDate,
      endDate: medication.endDate ?? null,
      notes: medication.notes ?? null,
      active: medication.active,
      createdBy: medication.createdBy,
      createdAt: medication.createdAt,
    };
  }

  toResponse(
    medication: Medication,
    reminderEnabled = false,
    advanceNotice?: AdvanceNotice,
  ): MedicationResponseDto {
    return {
      id: medication.id.toValue(),
      petId: medication.petId,
      name: medication.name,
      dosage: {
        amount: medication.dosage.amount,
        unit: medication.dosage.unit,
      },
      schedule: medication.schedule.toJSON(),
      startDate: medication.startDate.toISOString(),
      endDate: medication.endDate?.toISOString(),
      notes: medication.notes,
      active: medication.active,
      reminderEnabled,
      advanceNotice,
      createdBy: medication.createdBy,
      createdAt: medication.createdAt.toISOString(),
    };
  }
}
