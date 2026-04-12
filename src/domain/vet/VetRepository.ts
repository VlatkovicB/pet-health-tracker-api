import { Vet } from './Vet';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';

export interface VetRepository {
  findById(id: string): Promise<Vet | null>;
  findByUserId(userId: string, pagination: PaginationParams): Promise<PaginatedResult<Vet>>;
  save(vet: Vet): Promise<void>;
}

export const VET_REPOSITORY = 'VetRepository';
