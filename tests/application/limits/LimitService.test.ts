import 'reflect-metadata';
import { UserLimits } from '../../../src/domain/user/UserLimits';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';

describe('UserLimits', () => {
  it('reconstitutes from raw props', () => {
    const limits = UserLimits.reconstitute(
      { userId: 'u1', maxPets: 5, maxVets: null, maxMedications: null, maxNotes: null,
        maxStorageBytes: null, storageUsedBytes: 0,
        maxPlacesSearchesMonthly: null, placesSearchesThisMonth: 0,
        placesSearchesMonth: new Date('2026-05-01'), createdAt: new Date(), updatedAt: new Date() },
      new UniqueEntityId('lim-1'),
    );
    expect(limits.maxPets).toBe(5);
    expect(limits.storageUsedBytes).toBe(0);
  });
});
