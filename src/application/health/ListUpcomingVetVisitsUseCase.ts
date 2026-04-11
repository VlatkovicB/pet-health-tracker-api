import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { VetVisit } from '../../domain/health/VetVisit';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class ListUpcomingVetVisitsUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(groupId: string, requestingUserId: string): Promise<VetVisit[]> {
    const group = await this.groupRepository.findById(groupId);
    if (!group) throw new NotFoundError('Group');
    if (!group.hasMember(requestingUserId)) throw new ForbiddenError('Not a group member');
    return this.healthRepo.findUpcomingVetVisitsByGroupId(groupId);
  }
}
