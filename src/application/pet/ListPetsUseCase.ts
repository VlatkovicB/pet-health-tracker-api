import { Inject, Service } from 'typedi';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { Pet } from '../../domain/pet/Pet';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';

@Service()
export class ListPetsUseCase {
  constructor(
    @Inject(PET_REPOSITORY) private readonly petRepository: PetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(groupId: string, requestingUserId: string, pagination: PaginationParams): Promise<PaginatedResult<Pet>> {
    const group = await this.groupRepository.findById(groupId);
    if (!group) throw new NotFoundError('Group');
    if (!group.hasMember(requestingUserId)) throw new ForbiddenError('Not a group member');

    return this.petRepository.findByGroupId(groupId, pagination);
  }
}
