import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { Medication } from '../../domain/health/Medication';
import { Dosage } from '../../domain/health/value-objects/Dosage';
import { FrequencySchedule, FrequencyType } from '../../domain/health/value-objects/FrequencySchedule';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

export interface UpdateMedicationInput {
  medicationId: string;
  name?: string;
  dosageAmount?: number;
  dosageUnit?: string;
  frequency?: { type: FrequencyType; interval: number };
  startDate?: Date;
  endDate?: Date | null;
  notes?: string | null;
  active?: boolean;
  requestingUserId: string;
}

@Service()
export class UpdateMedicationUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(input: UpdateMedicationInput): Promise<Medication> {
    const existing = await this.healthRepo.findMedicationById(input.medicationId);
    if (!existing) throw new NotFoundError('Medication');

    const pet = await this.petRepository.findById(existing.petId);
    const group = await this.groupRepository.findById(pet!.groupId);
    if (!group?.hasMember(input.requestingUserId)) throw new ForbiddenError('Not a group member');

    const newDosageAmount = input.dosageAmount ?? existing.dosage.amount;
    const newDosageUnit = input.dosageUnit ?? existing.dosage.unit;
    const newFrequency = input.frequency
      ? FrequencySchedule.create(input.frequency)
      : existing.frequency;

    const updated = Medication.reconstitute(
      {
        petId: existing.petId,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
        name: input.name ?? existing.name,
        dosage: Dosage.create(newDosageAmount, newDosageUnit as any),
        frequency: newFrequency,
        startDate: input.startDate ?? existing.startDate,
        endDate: input.endDate === null ? undefined : (input.endDate ?? existing.endDate),
        notes: input.notes === null ? undefined : (input.notes ?? existing.notes),
        active: input.active ?? existing.active,
      },
      existing.id,
    );

    await this.healthRepo.saveMedication(updated);
    return updated;
  }
}
