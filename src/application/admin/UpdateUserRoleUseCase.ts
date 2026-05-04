import { Inject, Service } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { UserRole } from '../../domain/user/UserRole';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError';

interface UpdateUserRoleInput {
  targetUserId: string;
  role: UserRole;
  requestingUserId: string;
}

@Service()
export class UpdateUserRoleUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepo: UserRepository) {}

  async execute(input: UpdateUserRoleInput): Promise<void> {
    if (input.targetUserId === input.requestingUserId) {
      throw new ForbiddenError('Cannot change your own role');
    }
    const user = await this.userRepo.findById(input.targetUserId);
    if (!user) throw new NotFoundError('User');
    await this.userRepo.updateRole(input.targetUserId, input.role);
  }
}
