import { Inject, Service } from 'typedi';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { Group } from '../../domain/group/Group';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';

@Service()
export class ListGroupsUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(userId: string, pagination: PaginationParams): Promise<PaginatedResult<Group>> {
    return this.groupRepository.findByUserId(userId, pagination);
  }
}
