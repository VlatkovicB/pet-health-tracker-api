import { UserLimits, UserLimitsProps } from './UserLimits';

export interface UserLimitsRepository {
  findByUserId(userId: string): Promise<UserLimits | null>;
  upsert(userId: string, overrides: Partial<Pick<UserLimitsProps,
    'maxPets' | 'maxVets' | 'maxMedications' | 'maxNotes' |
    'maxStorageBytes' | 'maxPlacesSearchesMonthly'>>): Promise<void>;
  incrementStorage(userId: string, bytes: number): Promise<void>;
  decrementStorage(userId: string, bytes: number): Promise<void>;
  checkAndIncrementPlacesSearch(userId: string, effectiveLimit: number): Promise<void>;
}

export const USER_LIMITS_REPOSITORY = 'UserLimitsRepository';
