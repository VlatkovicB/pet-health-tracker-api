import { Inject, Service } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { AdminStatsRepository, ADMIN_STATS_REPOSITORY } from '../../domain/admin/AdminStatsRepository';
import { UserMapper } from '../../infrastructure/mappers/UserMapper';
import { PaginationParams } from '../../shared/types/Pagination';

@Service()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(ADMIN_STATS_REPOSITORY) private readonly statsRepo: AdminStatsRepository,
    private readonly userMapper: UserMapper,
  ) {}

  async execute(pagination: PaginationParams) {
    const result = await this.userRepo.findAllPaginated(pagination);
    const statsAll = await Promise.all(result.items.map(u => this.statsRepo.getUserStats(u.id.toValue())));
    return {
      ...result,
      items: result.items.map((u, i) => ({ ...this.userMapper.toResponse(u), stats: statsAll[i] })),
    };
  }
}
