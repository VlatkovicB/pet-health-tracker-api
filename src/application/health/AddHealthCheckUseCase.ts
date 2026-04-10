import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { HealthCheck } from '../../domain/health/HealthCheck';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

interface AddHealthCheckInput {
  petId: string;
  weightKg?: number;
  temperatureC?: number;
  notes?: string;
  checkedAt: Date;
  requestingUserId: string;
}

@Service()
export class AddHealthCheckUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(input: AddHealthCheckInput): Promise<HealthCheck> {
    const pet = await this.petRepository.findById(input.petId);
    if (!pet) throw new NotFoundError('Pet');

    const group = await this.groupRepository.findById(pet.groupId);
    if (!group?.hasMember(input.requestingUserId)) throw new ForbiddenError('Not a group member');

    const check = HealthCheck.create({
      petId: input.petId,
      weightKg: input.weightKg,
      temperatureC: input.temperatureC,
      notes: input.notes,
      checkedAt: input.checkedAt,
      createdBy: input.requestingUserId,
    });

    await this.healthRepo.saveHealthCheck(check);
    return check;
  }
}
