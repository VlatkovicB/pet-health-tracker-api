export interface AdminUserStats {
  pets: number;
  vets: number;
  vetVisits: number;
  medications: number;
  symptoms: number;
  healthChecks: number;
  notes: number;
  photos: number;
  reminders: number;
  storageUsedBytes: number;
  placesSearchesThisMonth: number;
}

export interface AdminStatsRepository {
  getUserStats(userId: string): Promise<AdminUserStats>;
}

export const ADMIN_STATS_REPOSITORY = 'AdminStatsRepository';
