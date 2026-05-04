import { User, ThemeMode } from './User';
import { UserRole } from './UserRole';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  updateTheme(userId: string, theme: ThemeMode): Promise<void>;
  updateRole(userId: string, role: UserRole): Promise<void>;
  findAllPaginated(pagination: PaginationParams): Promise<PaginatedResult<User>>;
  deleteById(userId: string): Promise<void>;
}

export const USER_REPOSITORY = 'UserRepository';
