import { Service } from 'typedi';
import { Op } from 'sequelize';
import { VetVisitModel } from '../models/VetVisitModel';
import { MedicationModel } from '../models/MedicationModel';
import { ReminderModel } from '../models/ReminderModel';
import { PetModel } from '../models/PetModel';
import { HealthRecordRepository, MedicationSummary } from '../../../domain/health/HealthRecordRepository';
import { VetVisit } from '../../../domain/health/VetVisit';
import { Medication } from '../../../domain/health/Medication';
import { VetVisitMapper } from '../../mappers/VetVisitMapper';
import { MedicationMapper } from '../../mappers/MedicationMapper';
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

  async findUpcomingVetVisitsByUserId(userId: string): Promise<VetVisit[]> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const rows = await VetVisitModel.findAll({
      where: {
        type: 'scheduled',
        visitDate: { [Op.gte]: startOfToday },
      },
      include: [{ model: PetModel, where: { userId }, required: true }],
      order: [['visit_date', 'ASC']],
    });
    return rows.map((m) => this.vetVisitMapper.toDomain(m));
  }

  async findVetVisitsByDateRange(userId: string, from: Date, to: Date): Promise<VetVisit[]> {
    const rows = await VetVisitModel.findAll({
      where: {
        visitDate: { [Op.between]: [from, to] },
      },
      include: [{ model: PetModel, where: { userId }, required: true }],
      order: [['visit_date', 'ASC']],
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

  async findMedicationsByPetId(petId: string): Promise<MedicationSummary[]> {
    const models = await MedicationModel.findAll({ where: { petId } });
    if (models.length === 0) return [];

    const ids = models.map((m) => m.id);
    const reminderModels = await ReminderModel.findAll({
      where: { entityType: 'medication', entityId: ids },
    });
    const reminderMap = new Map(reminderModels.map((r) => [r.entityId, r]));

    return models.map((m) => {
      const reminder = reminderMap.get(m.id);
      return {
        medication: this.medicationMapper.toDomain(m),
        reminderEnabled: reminder?.enabled ?? false,
        advanceNotice: reminder?.advanceNotice ?? undefined,
      };
    });
  }

  async findActiveMedications(): Promise<Medication[]> {
    const models = await MedicationModel.findAll({ where: { active: true } });
    return models.map((m) => this.medicationMapper.toDomain(m));
  }

  async saveMedication(medication: Medication): Promise<void> {
    await MedicationModel.upsert(this.medicationMapper.toPersistence(medication) as any);
  }
}
