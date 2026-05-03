import 'reflect-metadata';
import { LimitService, EffectiveLimits, LimitsWithUsage } from '../../../src/application/limits/LimitService';
import { UserLimitsRepository } from '../../../src/domain/user/UserLimitsRepository';
import { PetRepository } from '../../../src/domain/pet/PetRepository';
import { VetRepository } from '../../../src/domain/vet/VetRepository';
import { NoteRepository } from '../../../src/domain/note/NoteRepository';
import { HealthRecordRepository } from '../../../src/domain/health/HealthRecordRepository';
import { UserLimits } from '../../../src/domain/user/UserLimits';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError } from '../../../src/shared/errors/AppError';

function makeLimitsRow(overrides: Partial<{
  maxPets: number | null; maxVets: number | null;
  maxMedications: number | null; maxNotes: number | null;
  maxStorageBytes: number | null; storageUsedBytes: number;
  maxPlacesSearchesMonthly: number | null; placesSearchesThisMonth: number;
}> = {}): UserLimits {
  return UserLimits.reconstitute(
    {
      userId: 'u1',
      maxPets: overrides.maxPets ?? null,
      maxVets: overrides.maxVets ?? null,
      maxMedications: overrides.maxMedications ?? null,
      maxNotes: overrides.maxNotes ?? null,
      maxStorageBytes: overrides.maxStorageBytes ?? null,
      storageUsedBytes: overrides.storageUsedBytes ?? 0,
      maxPlacesSearchesMonthly: overrides.maxPlacesSearchesMonthly ?? null,
      placesSearchesThisMonth: overrides.placesSearchesThisMonth ?? 0,
      placesSearchesMonth: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    },
    new UniqueEntityId('lim-1'),
  );
}

function makeService(limitsRow: UserLimits | null, counts: {
  pets?: number; vets?: number; medications?: number; notes?: number;
} = {}, env: Record<string, string> = {}): LimitService {
  const limitsRepo = {
    findByUserId: jest.fn().mockResolvedValue(limitsRow),
    incrementStorage: jest.fn().mockResolvedValue(undefined),
    decrementStorage: jest.fn().mockResolvedValue(undefined),
    checkAndIncrementPlacesSearch: jest.fn().mockResolvedValue(undefined),
    upsert: jest.fn().mockResolvedValue(undefined),
  } as unknown as UserLimitsRepository;

  const petRepo = { countByUserId: jest.fn().mockResolvedValue(counts.pets ?? 0) } as unknown as PetRepository;
  const vetRepo = { countByUserId: jest.fn().mockResolvedValue(counts.vets ?? 0) } as unknown as VetRepository;
  const noteRepo = { countByUserId: jest.fn().mockResolvedValue(counts.notes ?? 0) } as unknown as NoteRepository;
  const healthRepo = { countMedicationsByUserId: jest.fn().mockResolvedValue(counts.medications ?? 0) } as unknown as HealthRecordRepository;

  Object.entries(env).forEach(([k, v]) => { process.env[k] = v; });

  return new LimitService(limitsRepo, petRepo, vetRepo, noteRepo, healthRepo);
}

describe('LimitService', () => {
  afterEach(() => {
    delete process.env.DEFAULT_MAX_PETS;
    delete process.env.DEFAULT_MAX_VETS;
    delete process.env.DEFAULT_MAX_MEDICATIONS;
    delete process.env.DEFAULT_MAX_NOTES;
    delete process.env.DEFAULT_MAX_STORAGE_BYTES;
    delete process.env.DEFAULT_MAX_PLACES_SEARCHES_MONTHLY;
  });

  describe('checkPetLimit', () => {
    it('allows when under per-user limit', async () => {
      const svc = makeService(makeLimitsRow({ maxPets: 5 }), { pets: 3 });
      await expect(svc.checkPetLimit('u1')).resolves.not.toThrow();
    });

    it('throws ForbiddenError when at per-user limit', async () => {
      const svc = makeService(makeLimitsRow({ maxPets: 5 }), { pets: 5 });
      await expect(svc.checkPetLimit('u1')).rejects.toThrow('Pet limit reached (5/5)');
    });

    it('falls back to env default when no per-user override', async () => {
      const svc = makeService(null, { pets: 10 }, { DEFAULT_MAX_PETS: '10' });
      await expect(svc.checkPetLimit('u1')).rejects.toThrow(ForbiddenError);
    });

    it('allows when no limit configured and no env default', async () => {
      const svc = makeService(null, { pets: 9999 });
      await expect(svc.checkPetLimit('u1')).resolves.not.toThrow();
    });
  });

  describe('checkVetLimit', () => {
    it('throws ForbiddenError when at per-user limit', async () => {
      const svc = makeService(makeLimitsRow({ maxVets: 3 }), { vets: 3 });
      await expect(svc.checkVetLimit('u1')).rejects.toThrow('Vet limit reached (3/3)');
    });
  });

  describe('checkMedicationLimit', () => {
    it('throws ForbiddenError when at per-user limit', async () => {
      const svc = makeService(makeLimitsRow({ maxMedications: 10 }), { medications: 10 });
      await expect(svc.checkMedicationLimit('u1')).rejects.toThrow('Medication limit reached (10/10)');
    });
  });

  describe('checkNoteLimit', () => {
    it('throws ForbiddenError when at per-user limit', async () => {
      const svc = makeService(makeLimitsRow({ maxNotes: 20 }), { notes: 20 });
      await expect(svc.checkNoteLimit('u1')).rejects.toThrow('Note limit reached (20/20)');
    });
  });

  describe('checkStorageLimit', () => {
    it('throws when storageUsed + new bytes exceeds limit', async () => {
      const svc = makeService(makeLimitsRow({ maxStorageBytes: 100, storageUsedBytes: 90 }));
      await expect(svc.checkStorageLimit('u1', 20)).rejects.toThrow(ForbiddenError);
    });

    it('allows when within limit', async () => {
      const svc = makeService(makeLimitsRow({ maxStorageBytes: 100, storageUsedBytes: 50 }));
      await expect(svc.checkStorageLimit('u1', 20)).resolves.not.toThrow();
    });
  });

  describe('getLimitsWithUsage', () => {
    it('returns usage and effective limits', async () => {
      const svc = makeService(
        makeLimitsRow({ maxPets: 5, storageUsedBytes: 1000 }),
        { pets: 3, vets: 1, medications: 0, notes: 2 },
        { DEFAULT_MAX_VETS: '20', DEFAULT_MAX_STORAGE_BYTES: '104857600' },
      );
      const result = await svc.getLimitsWithUsage('u1');
      expect(result.pets).toEqual({ used: 3, max: 5 });
      expect(result.vets).toEqual({ used: 1, max: 20 });
      expect(result.storage).toEqual({ usedBytes: 1000, maxBytes: 104857600 });
      expect(result.medications).toEqual({ used: 0, max: null });
      expect(result.notes).toEqual({ used: 2, max: null });
      expect(result.placesSearches).toEqual({ usedThisMonth: 0, max: null });
    });
  });
});
