import { VetVisit } from './VetVisit';
import { Medication } from './Medication';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';

export interface HealthRecordRepository {
  // Vet visits
  findVetVisitById(id: string): Promise<VetVisit | null>;
  findVetVisitsByPetId(petId: string, pagination: PaginationParams): Promise<PaginatedResult<VetVisit>>;
  findUpcomingVetVisitsByUserId(userId: string): Promise<VetVisit[]>;
  findVetVisitsByDateRange(userId: string, from: Date, to: Date): Promise<VetVisit[]>;
  saveVetVisit(visit: VetVisit): Promise<void>;

  // Medications
  findMedicationById(id: string): Promise<Medication | null>;
  findMedicationsByPetId(petId: string): Promise<Medication[]>;
  findActiveMedications(): Promise<Medication[]>;
  saveMedication(medication: Medication): Promise<void>;
}

export const HEALTH_RECORD_REPOSITORY = 'HealthRecordRepository';
