import { Service } from 'typedi';
import { AdminStatsRepository, AdminUserStats } from '../../../domain/admin/AdminStatsRepository';
import { PetModel } from '../models/PetModel';
import { VetModel } from '../models/VetModel';
import { VetVisitModel } from '../models/VetVisitModel';
import { MedicationModel } from '../models/MedicationModel';
import { NoteModel } from '../models/NoteModel';
import { PhotoModel } from '../models/PhotoModel';
import { ReminderModel } from '../models/ReminderModel';
import { UserLimitsModel } from '../models/UserLimitsModel';

@Service()
export class SequelizeAdminStatsRepository implements AdminStatsRepository {
  async getUserStats(userId: string): Promise<AdminUserStats> {
    const [pets, vets, notes, photos, limitsRow] = await Promise.all([
      PetModel.count({ where: { userId } }),
      VetModel.count({ where: { userId } }),
      NoteModel.count({ where: { userId } }),
      PhotoModel.count({ where: { ownerId: userId } }),
      UserLimitsModel.findOne({ where: { userId } }),
    ]);

    const petModels = await PetModel.findAll({ where: { userId }, attributes: ['id'] });
    const petIds = petModels.map(p => p.id);

    const [vetVisits, medications] = petIds.length > 0
      ? await Promise.all([
          VetVisitModel.count({ where: { petId: petIds } }),
          MedicationModel.count({ where: { petId: petIds } }),
        ])
      : [0, 0];

    const reminders = await ReminderModel.count({ where: { createdBy: userId } });

    return {
      pets,
      vets,
      vetVisits,
      medications,
      symptoms: 0,
      healthChecks: 0,
      notes,
      photos,
      reminders,
      storageUsedBytes: limitsRow ? Number(limitsRow.storageUsedBytes) : 0,
      placesSearchesThisMonth: limitsRow?.placesSearchesThisMonth ?? 0,
    };
  }
}
