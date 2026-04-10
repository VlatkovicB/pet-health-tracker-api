import { Inject, Service } from 'typedi';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { Group } from '../../domain/group/Group';

interface CreateGroupInput {
  name: string;
  ownerUserId: string;
}

@Service()
export class CreateGroupUseCase {
  constructor(@Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository) {}

  async execute(input: CreateGroupInput): Promise<Group> {
    const group = Group.create(input.name, input.ownerUserId);
    await this.groupRepository.save(group);
    return group;
  }
}
