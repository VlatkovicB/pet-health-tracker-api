import { Inject, Service } from 'typedi';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { Group } from '../../domain/group/Group';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

@Service()
export class GetGroupUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(groupId: string, requestingUserId: string): Promise<Group> {
    const group = await this.groupRepository.findById(groupId);
    if (!group) throw new NotFoundError('Group');
    if (!group.hasMember(requestingUserId)) throw new ForbiddenError('Not a group member');
    return group;
  }
}
