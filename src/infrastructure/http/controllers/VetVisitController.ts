import { JsonController, Get, QueryParams, UseBefore, CurrentUser } from 'routing-controllers';
import { Inject, Service } from 'typedi';
import { ListVetVisitsByDateRangeUseCase } from '../../../application/health/ListVetVisitsByDateRangeUseCase';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../../domain/health/HealthRecordRepository';
import { VetVisitMapper } from '../../mappers/VetVisitMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { VetVisitsByDateRangeQuerySchema, VetVisitsByDateRangeQuery } from '../schemas/healthSchemas';

@JsonController('/vet-visits')
@Service()
@UseBefore(authMiddleware)
export class VetVisitController {
  constructor(
    private readonly listVetVisitsByDateRange: ListVetVisitsByDateRangeUseCase,
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    private readonly vetVisitMapper: VetVisitMapper,
  ) {}

  @Get('/upcoming')
  async getUpcoming(@CurrentUser() user: AuthPayload) {
    const visits = await this.healthRepo.findUpcomingVetVisitsByUserId(user.userId);
    return visits.map(v => this.vetVisitMapper.toResponse(v));
  }

  @Get('/')
  @Validate({ query: VetVisitsByDateRangeQuerySchema })
  async getByDateRange(@QueryParams() query: VetVisitsByDateRangeQuery, @CurrentUser() user: AuthPayload) {
    const endDate = new Date(query.to);
    endDate.setHours(23, 59, 59, 999);
    const visits = await this.listVetVisitsByDateRange.execute(user.userId, query.from, endDate);
    return visits.map(v => this.vetVisitMapper.toResponse(v));
  }
}
