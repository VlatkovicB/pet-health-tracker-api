import { VetVisit } from './VetVisit';
import { Medication } from './Medication';
import { Symptom } from './Symptom';
import { HealthCheck } from './HealthCheck';
import { PaginationParams, PaginatedResult } from '../../shared/types/Pagination';

export interface HealthRecordRepository {
  // Vet visits
  findVetVisitById(id: string): Promise<VetVisit | null>;
  findVetVisitsByPetId(petId: string, pagination: PaginationParams): Promise<PaginatedResult<VetVisit>>;
  findUpcomingVetVisitsByGroupId(groupId: string): Promise<VetVisit[]>;
  saveVetVisit(visit: VetVisit): Promise<void>;

  // Medications
  findMedicationById(id: string): Promise<Medication | null>;
  findMedicationsByPetId(petId: string): Promise<Medication[]>;
  findActiveMedications(): Promise<Medication[]>;
  saveMedication(medication: Medication): Promise<void>;

  // Symptoms
  findSymptomById(id: string): Promise<Symptom | null>;
  findSymptomsByPetId(petId: string, pagination: PaginationParams): Promise<PaginatedResult<Symptom>>;
  saveSymptom(symptom: Symptom): Promise<void>;

  // Health checks
  findHealthCheckById(id: string): Promise<HealthCheck | null>;
  findHealthChecksByPetId(petId: string, pagination: PaginationParams): Promise<PaginatedResult<HealthCheck>>;
  saveHealthCheck(check: HealthCheck): Promise<void>;
}

export const HEALTH_RECORD_REPOSITORY = 'HealthRecordRepository';
