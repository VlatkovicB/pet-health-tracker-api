import { Inject, Service } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { UserLimitsRepository, USER_LIMITS_REPOSITORY } from '../../domain/user/UserLimitsRepository';
import { UserLimitsProps } from '../../domain/user/UserLimits';
import { NotFoundError } from '../../shared/errors/AppError';

type LimitOverrides = Partial<Pick<UserLimitsProps,
  'maxPets' | 'maxVets' | 'maxMedications' | 'maxNotes' |
  'maxStorageBytes' | 'maxPlacesSearchesMonthly'>>;

@Service()
export class UpsertUserLimitsUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(USER_LIMITS_REPOSITORY) private readonly limitsRepo: UserLimitsRepository,
  ) {}

  async execute(input: { targetUserId: string; limits: LimitOverrides }): Promise<void> {
    const user = await this.userRepo.findById(input.targetUserId);
    if (!user) throw new NotFoundError('User');
    await this.limitsRepo.upsert(input.targetUserId, input.limits);
  }
}
