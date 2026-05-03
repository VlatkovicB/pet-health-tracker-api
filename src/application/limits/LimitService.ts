import { Inject, Service } from 'typedi';
import { UserLimitsRepository, USER_LIMITS_REPOSITORY } from '../../domain/user/UserLimitsRepository';
import { PetRepository, PET_REPOSITORY } from '../../domain/pet/PetRepository';
import { VetRepository, VET_REPOSITORY } from '../../domain/vet/VetRepository';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../domain/health/HealthRecordRepository';
import { ForbiddenError } from '../../shared/errors/AppError';

export interface EffectiveLimits {
  maxPets: number | null;
  maxVets: number | null;
  maxMedications: number | null;
  maxNotes: number | null;
  maxStorageBytes: number | null;
  maxPlacesSearchesMonthly: number | null;
}

export interface LimitsWithUsage {
  pets: { used: number; max: number | null };
  vets: { used: number; max: number | null };
  medications: { used: number; max: number | null };
  notes: { used: number; max: number | null };
  storage: { usedBytes: number; maxBytes: number | null };
  placesSearches: { usedThisMonth: number; max: number | null };
}

@Service()
export class LimitService {
  constructor(
    @Inject(USER_LIMITS_REPOSITORY) private readonly limitsRepo: UserLimitsRepository,
    @Inject(PET_REPOSITORY) private readonly petRepo: PetRepository,
    @Inject(VET_REPOSITORY) private readonly vetRepo: VetRepository,
    @Inject(NOTE_REPOSITORY) private readonly noteRepo: NoteRepository,
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
  ) {}

  async resolveEffectiveLimits(userId: string): Promise<{ limits: EffectiveLimits; row: import('../../domain/user/UserLimits').UserLimits | null }> {
    const row = await this.limitsRepo.findByUserId(userId);
    const env = (key: string) => process.env[key] ? Number(process.env[key]) : null;
    return {
      limits: {
        maxPets: row?.maxPets ?? env('DEFAULT_MAX_PETS'),
        maxVets: row?.maxVets ?? env('DEFAULT_MAX_VETS'),
        maxMedications: row?.maxMedications ?? env('DEFAULT_MAX_MEDICATIONS'),
        maxNotes: row?.maxNotes ?? env('DEFAULT_MAX_NOTES'),
        maxStorageBytes: row?.maxStorageBytes ?? env('DEFAULT_MAX_STORAGE_BYTES'),
        maxPlacesSearchesMonthly: row?.maxPlacesSearchesMonthly ?? env('DEFAULT_MAX_PLACES_SEARCHES_MONTHLY'),
      },
      row,
    };
  }

  async checkPetLimit(userId: string): Promise<void> {
    const { limits } = await this.resolveEffectiveLimits(userId);
    if (limits.maxPets === null) return;
    const count = await this.petRepo.countByUserId(userId);
    if (count >= limits.maxPets) throw new ForbiddenError(`Pet limit reached (${count}/${limits.maxPets})`);
  }

  async checkVetLimit(userId: string): Promise<void> {
    const { limits } = await this.resolveEffectiveLimits(userId);
    if (limits.maxVets === null) return;
    const count = await this.vetRepo.countByUserId(userId);
    if (count >= limits.maxVets) throw new ForbiddenError(`Vet limit reached (${count}/${limits.maxVets})`);
  }

  async checkMedicationLimit(userId: string): Promise<void> {
    const { limits } = await this.resolveEffectiveLimits(userId);
    if (limits.maxMedications === null) return;
    const count = await this.healthRepo.countMedicationsByUserId(userId);
    if (count >= limits.maxMedications) throw new ForbiddenError(`Medication limit reached (${count}/${limits.maxMedications})`);
  }

  async checkNoteLimit(userId: string): Promise<void> {
    const { limits } = await this.resolveEffectiveLimits(userId);
    if (limits.maxNotes === null) return;
    const count = await this.noteRepo.countByUserId(userId);
    if (count >= limits.maxNotes) throw new ForbiddenError(`Note limit reached (${count}/${limits.maxNotes})`);
  }

  async checkStorageLimit(userId: string, newBytes: number): Promise<void> {
    const { limits, row } = await this.resolveEffectiveLimits(userId);
    if (limits.maxStorageBytes === null) return;
    const usedBytes = row ? row.storageUsedBytes : 0;
    if (usedBytes + newBytes > limits.maxStorageBytes) {
      throw new ForbiddenError(`Storage limit reached (${(limits.maxStorageBytes / 1024 / 1024).toFixed(0)} MB)`);
    }
  }

  async incrementStorage(userId: string, bytes: number): Promise<void> {
    await this.limitsRepo.incrementStorage(userId, bytes);
  }

  async decrementStorage(userId: string, bytes: number): Promise<void> {
    await this.limitsRepo.decrementStorage(userId, bytes);
  }

  async checkAndIncrementPlacesSearch(userId: string): Promise<void> {
    const { limits } = await this.resolveEffectiveLimits(userId);
    if (limits.maxPlacesSearchesMonthly === null) return;
    await this.limitsRepo.checkAndIncrementPlacesSearch(userId, limits.maxPlacesSearchesMonthly);
  }

  async getLimitsWithUsage(userId: string): Promise<LimitsWithUsage> {
    const env = (key: string) => process.env[key] ? Number(process.env[key]) : null;
    const [row, pets, vets, medications, notes] = await Promise.all([
      this.limitsRepo.findByUserId(userId),
      this.petRepo.countByUserId(userId),
      this.vetRepo.countByUserId(userId),
      this.healthRepo.countMedicationsByUserId(userId),
      this.noteRepo.countByUserId(userId),
    ]);
    return {
      pets:  { used: pets,        max: row?.maxPets         ?? env('DEFAULT_MAX_PETS') },
      vets:  { used: vets,        max: row?.maxVets         ?? env('DEFAULT_MAX_VETS') },
      medications: { used: medications, max: row?.maxMedications ?? env('DEFAULT_MAX_MEDICATIONS') },
      notes: { used: notes,       max: row?.maxNotes        ?? env('DEFAULT_MAX_NOTES') },
      storage: { usedBytes: row?.storageUsedBytes ?? 0, maxBytes: row?.maxStorageBytes ?? env('DEFAULT_MAX_STORAGE_BYTES') },
      placesSearches: {
        usedThisMonth: row?.placesSearchesThisMonth ?? 0,
        max: row?.maxPlacesSearchesMonthly ?? env('DEFAULT_MAX_PLACES_SEARCHES_MONTHLY'),
      },
    };
  }
}
