import { User } from './User';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export const USER_REPOSITORY = 'UserRepository';
