import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { Medication } from '../../domain/health/Medication';
import { Dosage } from '../../domain/health/value-objects/Dosage';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

interface LogMedicationInput {
  petId: string;
  name: string;
  dosageAmount: number;
  dosageUnit: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  notes?: string;
  requestingUserId: string;
}

@Service()
export class LogMedicationUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(input: LogMedicationInput): Promise<Medication> {
    const pet = await this.petRepository.findById(input.petId);
    if (!pet) throw new NotFoundError('Pet');

    const group = await this.groupRepository.findById(pet.groupId);
    if (!group?.hasMember(input.requestingUserId)) throw new ForbiddenError('Not a group member');

    const medication = Medication.create({
      petId: input.petId,
      name: input.name,
      dosage: Dosage.create(input.dosageAmount, input.dosageUnit as any),
      frequency: input.frequency,
      startDate: input.startDate,
      endDate: input.endDate,
      notes: input.notes,
      active: true,
      createdBy: input.requestingUserId,
    });

    await this.healthRepo.saveMedication(medication);
    return medication;
  }
}
