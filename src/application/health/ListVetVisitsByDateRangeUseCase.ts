import { Inject, Service } from 'typedi';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { VetVisit } from '../../domain/health/VetVisit';

@Service()
export class ListVetVisitsByDateRangeUseCase {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
  ) {}

  async execute(userId: string, from: Date, to: Date): Promise<VetVisit[]> {
    return this.healthRepo.findVetVisitsByDateRange(userId, from, to);
  }
}
