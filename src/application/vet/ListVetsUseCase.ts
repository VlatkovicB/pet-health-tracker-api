import { Inject, Service } from 'typedi';
import { VetRepository, VET_REPOSITORY } from '../../domain/vet/VetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { Vet } from '../../domain/vet/Vet';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';

@Service()
export class ListVetsUseCase {
  constructor(
    @Inject(VET_REPOSITORY) private readonly vetRepository: VetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(groupId: string, requestingUserId: string, pagination: PaginationParams): Promise<PaginatedResult<Vet>> {
    const group = await this.groupRepository.findById(groupId);
    if (!group) throw new NotFoundError('Group');
    if (!group.hasMember(requestingUserId)) throw new ForbiddenError('Not a group member');

    return this.vetRepository.findByGroupId(groupId, pagination);
  }
}
