import { Service } from 'typedi';
import { MedicationModel } from '../db/models/MedicationModel';
import { Medication, MedicationReminder } from '../../domain/health/Medication';
import { Dosage } from '../../domain/health/value-objects/Dosage';
import { ReminderSchedule } from '../../domain/health/value-objects/ReminderSchedule';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface ReminderResponseDto {
  schedule: {
    times?: string[];
    intervalHours?: number;
    days?: string[];
    timezone: string;
  };
  enabled: boolean;
  notifyUserIds: string[];
}

export interface MedicationResponseDto {
  id: string;
  petId: string;
  name: string;
  dosage: { amount: number; unit: string };
  frequency: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  active: boolean;
  reminder?: ReminderResponseDto;
  createdBy: string;
  createdAt: string;
}

@Service()
export class MedicationMapper {
  toDomain(model: MedicationModel): Medication {
    const raw = model.reminder as any;
    let reminder: MedicationReminder | undefined;

    if (raw) {
      reminder = {
        schedule: ReminderSchedule.create(raw.schedule),
        enabled: raw.enabled,
        notifyUserIds: raw.notifyUserIds,
      };
    }

    return Medication.reconstitute(
      {
        petId: model.petId,
        name: model.name,
        dosage: Dosage.create(model.dosageAmount, model.dosageUnit as any),
        frequency: model.frequency,
        startDate: model.startDate,
        endDate: model.endDate ?? undefined,
        notes: model.notes ?? undefined,
        active: model.active,
        reminder,
        createdBy: model.createdBy,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(medication: Medication): object {
    const { reminder } = medication;
    return {
      id: medication.id.toValue(),
      petId: medication.petId,
      name: medication.name,
      dosageAmount: medication.dosage.amount,
      dosageUnit: medication.dosage.unit,
      frequency: medication.frequency,
      startDate: medication.startDate,
      endDate: medication.endDate ?? null,
      notes: medication.notes ?? null,
      active: medication.active,
      reminder: reminder
        ? {
            schedule: reminder.schedule['props'],
            enabled: reminder.enabled,
            notifyUserIds: reminder.notifyUserIds,
          }
        : null,
      createdBy: medication.createdBy,
      createdAt: medication.createdAt,
    };
  }

  toResponse(medication: Medication): MedicationResponseDto {
    const { reminder } = medication;
    return {
      id: medication.id.toValue(),
      petId: medication.petId,
      name: medication.name,
      dosage: {
        amount: medication.dosage.amount,
        unit: medication.dosage.unit,
      },
      frequency: medication.frequency,
      startDate: medication.startDate.toISOString(),
      endDate: medication.endDate?.toISOString(),
      notes: medication.notes,
      active: medication.active,
      reminder: reminder
        ? {
            schedule: {
              times: reminder.schedule.times,
              intervalHours: reminder.schedule.intervalHours,
              days: reminder.schedule.days,
              timezone: reminder.schedule.timezone,
            },
            enabled: reminder.enabled,
            notifyUserIds: reminder.notifyUserIds,
          }
        : undefined,
      createdBy: medication.createdBy,
      createdAt: medication.createdAt.toISOString(),
    };
  }
}
