import { Inject, Service } from 'typedi';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

interface InviteUserInput {
  groupId: string;
  inviterUserId: string;
  inviteeEmail: string;
}

@Service()
export class InviteUserUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  async execute(input: InviteUserInput): Promise<void> {
    const group = await this.groupRepository.findById(input.groupId);
    if (!group) throw new NotFoundError('Group');

    const role = group.getMemberRole(input.inviterUserId);
    if (role !== 'owner') throw new ForbiddenError('Only group owners can invite members');

    const invitee = await this.userRepository.findByEmail(input.inviteeEmail);
    if (!invitee) throw new NotFoundError('User');

    group.addMember(invitee.id.toValue(), 'member');
    await this.groupRepository.save(group);
  }
}
