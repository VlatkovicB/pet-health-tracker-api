import { Group } from './Group';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';

export interface GroupRepository {
  findById(id: string): Promise<Group | null>;
  findByUserId(userId: string, pagination: PaginationParams): Promise<PaginatedResult<Group>>;
  save(group: Group): Promise<void>;
  delete(id: string): Promise<void>;
}

export const GROUP_REPOSITORY = 'GroupRepository';
