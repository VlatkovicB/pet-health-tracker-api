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

  async resolveEffectiveLimits(userId: string): Promise<EffectiveLimits> {
    const row = await this.limitsRepo.findByUserId(userId);
    const env = (key: string) => process.env[key] ? Number(process.env[key]) : null;
    return {
      maxPets: row?.maxPets ?? env('DEFAULT_MAX_PETS'),
      maxVets: row?.maxVets ?? env('DEFAULT_MAX_VETS'),
      maxMedications: row?.maxMedications ?? env('DEFAULT_MAX_MEDICATIONS'),
      maxNotes: row?.maxNotes ?? env('DEFAULT_MAX_NOTES'),
      maxStorageBytes: row?.maxStorageBytes ?? env('DEFAULT_MAX_STORAGE_BYTES'),
      maxPlacesSearchesMonthly: row?.maxPlacesSearchesMonthly ?? env('DEFAULT_MAX_PLACES_SEARCHES_MONTHLY'),
    };
  }

  async checkPetLimit(userId: string): Promise<void> {
    const { maxPets } = await this.resolveEffectiveLimits(userId);
    if (maxPets === null) return;
    const count = await this.petRepo.countByUserId(userId);
    if (count >= maxPets) throw new ForbiddenError(`Pet limit reached (${maxPets})`);
  }

  async checkVetLimit(userId: string): Promise<void> {
    const { maxVets } = await this.resolveEffectiveLimits(userId);
    if (maxVets === null) return;
    const count = await this.vetRepo.countByUserId(userId);
    if (count >= maxVets) throw new ForbiddenError(`Vet limit reached (${maxVets})`);
  }

  async checkMedicationLimit(userId: string): Promise<void> {
    const { maxMedications } = await this.resolveEffectiveLimits(userId);
    if (maxMedications === null) return;
    const count = await this.healthRepo.countMedicationsByUserId(userId);
    if (count >= maxMedications) throw new ForbiddenError(`Medication limit reached (${maxMedications})`);
  }

  async checkNoteLimit(userId: string): Promise<void> {
    const { maxNotes } = await this.resolveEffectiveLimits(userId);
    if (maxNotes === null) return;
    const count = await this.noteRepo.countByUserId(userId);
    if (count >= maxNotes) throw new ForbiddenError(`Note limit reached (${maxNotes})`);
  }

  async checkStorageLimit(userId: string, newBytes: number): Promise<void> {
    const { maxStorageBytes } = await this.resolveEffectiveLimits(userId);
    if (maxStorageBytes === null) return;
    const row = await this.limitsRepo.findByUserId(userId);
    const usedBytes = row ? row.storageUsedBytes : 0;
    if (usedBytes + newBytes > maxStorageBytes) {
      throw new ForbiddenError(`Storage limit reached (${(maxStorageBytes / 1024 / 1024).toFixed(0)} MB)`);
    }
  }

  async incrementStorage(userId: string, bytes: number): Promise<void> {
    await this.limitsRepo.incrementStorage(userId, bytes);
  }

  async decrementStorage(userId: string, bytes: number): Promise<void> {
    await this.limitsRepo.decrementStorage(userId, bytes);
  }

  async checkAndIncrementPlacesSearch(userId: string): Promise<void> {
    const { maxPlacesSearchesMonthly } = await this.resolveEffectiveLimits(userId);
    if (maxPlacesSearchesMonthly === null) return;
    await this.limitsRepo.checkAndIncrementPlacesSearch(userId, maxPlacesSearchesMonthly);
  }

  async getLimitsWithUsage(userId: string): Promise<LimitsWithUsage> {
    const [limits, row, pets, vets, medications, notes] = await Promise.all([
      this.resolveEffectiveLimits(userId),
      this.limitsRepo.findByUserId(userId),
      this.petRepo.countByUserId(userId),
      this.vetRepo.countByUserId(userId),
      this.healthRepo.countMedicationsByUserId(userId),
      this.noteRepo.countByUserId(userId),
    ]);
    return {
      pets: { used: pets, max: limits.maxPets },
      vets: { used: vets, max: limits.maxVets },
      medications: { used: medications, max: limits.maxMedications },
      notes: { used: notes, max: limits.maxNotes },
      storage: { usedBytes: row?.storageUsedBytes ?? 0, maxBytes: limits.maxStorageBytes },
      placesSearches: {
        usedThisMonth: row?.placesSearchesThisMonth ?? 0,
        max: limits.maxPlacesSearchesMonthly,
      },
    };
  }
}
