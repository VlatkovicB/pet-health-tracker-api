import { Pet } from './Pet';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';

export interface PetRepository {
  findById(id: string): Promise<Pet | null>;
  findByUserId(userId: string, pagination: PaginationParams): Promise<PaginatedResult<Pet>>;
  save(pet: Pet): Promise<void>;
  delete(id: string): Promise<void>;
}

export const PET_REPOSITORY = 'PetRepository';
