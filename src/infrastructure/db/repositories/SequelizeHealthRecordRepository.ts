import { Service } from 'typedi';
import { Op } from 'sequelize';
import { VetVisitModel } from '../models/VetVisitModel';
import { MedicationModel } from '../models/MedicationModel';
import { SymptomModel } from '../models/SymptomModel';
import { HealthCheckModel } from '../models/HealthCheckModel';
import { PetModel } from '../models/PetModel';
import { HealthRecordRepository } from '../../../domain/health/HealthRecordRepository';
import { VetVisit } from '../../../domain/health/VetVisit';
import { Medication } from '../../../domain/health/Medication';
import { Symptom } from '../../../domain/health/Symptom';
import { HealthCheck } from '../../../domain/health/HealthCheck';
import { VetVisitMapper } from '../../mappers/VetVisitMapper';
import { MedicationMapper } from '../../mappers/MedicationMapper';
import { SymptomMapper } from '../../mappers/SymptomMapper';
import { HealthCheckMapper } from '../../mappers/HealthCheckMapper';
import { PaginationParams, PaginatedResult } from '../../../shared/types/Pagination';

function toResult<T>(rows: T[], count: number, page: number, limit: number): PaginatedResult<T> {
  const offset = (page - 1) * limit;
  return {
    items: rows,
    total: count,
    nextPage: offset + rows.length < count ? page + 1 : null,
  };
}

@Service()
export class SequelizeHealthRecordRepository implements HealthRecordRepository {
  constructor(
    private readonly vetVisitMapper: VetVisitMapper,
    private readonly medicationMapper: MedicationMapper,
    private readonly symptomMapper: SymptomMapper,
    private readonly healthCheckMapper: HealthCheckMapper,
  ) {}

  // --- VetVisit ---

  async findVetVisitById(id: string): Promise<VetVisit | null> {
    const model = await VetVisitModel.findByPk(id);
    return model ? this.vetVisitMapper.toDomain(model) : null;
  }

  async findVetVisitsByPetId(petId: string, { page, limit }: PaginationParams): Promise<PaginatedResult<VetVisit>> {
    const { count, rows } = await VetVisitModel.findAndCountAll({
      where: { petId },
      order: [['visit_date', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return toResult(rows.map((m) => this.vetVisitMapper.toDomain(m)), count, page, limit);
  }

  async findUpcomingVetVisitsByGroupId(groupId: string): Promise<VetVisit[]> {
    const rows = await VetVisitModel.findAll({
      where: { nextVisitDate: { [Op.gt]: new Date() } },
      include: [{ model: PetModel, where: { groupId }, required: true }],
      order: [['next_visit_date', 'ASC']],
    });
    return rows.map((m) => this.vetVisitMapper.toDomain(m));
  }

  async saveVetVisit(visit: VetVisit): Promise<void> {
    await VetVisitModel.upsert(this.vetVisitMapper.toPersistence(visit) as any);
  }

  // --- Medication ---

  async findMedicationById(id: string): Promise<Medication | null> {
    const model = await MedicationModel.findByPk(id);
    return model ? this.medicationMapper.toDomain(model) : null;
  }

  async findMedicationsByPetId(petId: string): Promise<Medication[]> {
    const models = await MedicationModel.findAll({ where: { petId } });
    return models.map((m) => this.medicationMapper.toDomain(m));
  }

  async findActiveMedications(): Promise<Medication[]> {
    const models = await MedicationModel.findAll({ where: { active: true } });
    return models.map((m) => this.medicationMapper.toDomain(m));
  }

  async saveMedication(medication: Medication): Promise<void> {
    await MedicationModel.upsert(this.medicationMapper.toPersistence(medication) as any);
  }

  // --- Symptom ---

  async findSymptomById(id: string): Promise<Symptom | null> {
    const model = await SymptomModel.findByPk(id);
    return model ? this.symptomMapper.toDomain(model) : null;
  }

  async findSymptomsByPetId(petId: string, { page, limit }: PaginationParams): Promise<PaginatedResult<Symptom>> {
    const { count, rows } = await SymptomModel.findAndCountAll({
      where: { petId },
      order: [['observed_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return toResult(rows.map((m) => this.symptomMapper.toDomain(m)), count, page, limit);
  }

  async saveSymptom(symptom: Symptom): Promise<void> {
    await SymptomModel.upsert(this.symptomMapper.toPersistence(symptom) as any);
  }

  // --- HealthCheck ---

  async findHealthCheckById(id: string): Promise<HealthCheck | null> {
    const model = await HealthCheckModel.findByPk(id);
    return model ? this.healthCheckMapper.toDomain(model) : null;
  }

  async findHealthChecksByPetId(petId: string, { page, limit }: PaginationParams): Promise<PaginatedResult<HealthCheck>> {
    const { count, rows } = await HealthCheckModel.findAndCountAll({
      where: { petId },
      order: [['checked_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return toResult(rows.map((m) => this.healthCheckMapper.toDomain(m)), count, page, limit);
  }

  async saveHealthCheck(check: HealthCheck): Promise<void> {
    await HealthCheckModel.upsert(this.healthCheckMapper.toPersistence(check) as any);
  }
}
