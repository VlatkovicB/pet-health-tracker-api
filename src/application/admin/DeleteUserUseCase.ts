import { Inject, Service } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError';

@Service()
export class DeleteUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepo: UserRepository) {}

  async execute(input: { targetUserId: string; requestingUserId: string }): Promise<void> {
    if (input.targetUserId === input.requestingUserId) {
      throw new ForbiddenError('Cannot delete your own account');
    }
    const user = await this.userRepo.findById(input.targetUserId);
    if (!user) throw new NotFoundError('User');
    await this.userRepo.deleteById(input.targetUserId);
  }
}
