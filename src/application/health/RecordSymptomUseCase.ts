import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { Symptom } from '../../domain/health/Symptom';
import { Severity, SeverityLevel } from '../../domain/health/value-objects/Severity';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

interface RecordSymptomInput {
  petId: string;
  description: string;
  severity: SeverityLevel;
  observedAt: Date;
  notes?: string;
  requestingUserId: string;
}

@Service()
export class RecordSymptomUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(input: RecordSymptomInput): Promise<Symptom> {
    const pet = await this.petRepository.findById(input.petId);
    if (!pet) throw new NotFoundError('Pet');

    const group = await this.groupRepository.findById(pet.groupId);
    if (!group?.hasMember(input.requestingUserId)) throw new ForbiddenError('Not a group member');

    const symptom = Symptom.create({
      petId: input.petId,
      description: input.description,
      severity: Severity.create(input.severity),
      observedAt: input.observedAt,
      notes: input.notes,
      createdBy: input.requestingUserId,
    });

    await this.healthRepo.saveSymptom(symptom);
    return symptom;
  }
}
