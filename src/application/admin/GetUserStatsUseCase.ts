import { Inject, Service } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { AdminStatsRepository, ADMIN_STATS_REPOSITORY } from '../../domain/admin/AdminStatsRepository';
import { UserLimitsRepository, USER_LIMITS_REPOSITORY } from '../../domain/user/UserLimitsRepository';
import { UserMapper } from '../../infrastructure/mappers/UserMapper';
import { NotFoundError } from '../../shared/errors/AppError';

@Service()
export class GetUserStatsUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(ADMIN_STATS_REPOSITORY) private readonly statsRepo: AdminStatsRepository,
    @Inject(USER_LIMITS_REPOSITORY) private readonly limitsRepo: UserLimitsRepository,
    private readonly userMapper: UserMapper,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User');
    const [stats, limits] = await Promise.all([
      this.statsRepo.getUserStats(userId),
      this.limitsRepo.findByUserId(userId),
    ]);
    return { ...this.userMapper.toResponse(user), stats, limits: limits ?? null };
  }
}
