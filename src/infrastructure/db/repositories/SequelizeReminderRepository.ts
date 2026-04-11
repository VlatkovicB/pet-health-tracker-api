import { Service } from 'typedi';
import { ReminderRepository } from '../../../domain/reminder/ReminderRepository';
import { Reminder } from '../../../domain/reminder/Reminder';
import { ReminderModel } from '../models/ReminderModel';
import { ReminderNotifyUserModel } from '../models/ReminderNotifyUserModel';
import { ReminderMapper } from '../../mappers/ReminderMapper';
import { sequelize } from '../database';

const INCLUDE_NOTIFY = [{ model: ReminderNotifyUserModel }];

@Service()
export class SequelizeReminderRepository implements ReminderRepository {
  constructor(private readonly mapper: ReminderMapper) {}

  async findById(id: string): Promise<Reminder | null> {
    const model = await ReminderModel.findByPk(id, { include: INCLUDE_NOTIFY });
    return model ? this.mapper.toDomain(model) : null;
  }

  async findByEntityId(entityId: string): Promise<Reminder | null> {
    const model = await ReminderModel.findOne({ where: { entityId }, include: INCLUDE_NOTIFY });
    return model ? this.mapper.toDomain(model) : null;
  }

  async findAllEnabled(): Promise<Reminder[]> {
    const models = await ReminderModel.findAll({ where: { enabled: true }, include: INCLUDE_NOTIFY });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async save(reminder: Reminder): Promise<void> {
    await sequelize.transaction(async (t) => {
      await ReminderModel.upsert(this.mapper.toPersistence(reminder) as any, { transaction: t });

      // Sync notify users: delete all then re-insert
      await ReminderNotifyUserModel.destroy({
        where: { reminderId: reminder.id.toValue() },
        transaction: t,
      });

      if (reminder.notifyUserIds.length > 0) {
        await ReminderNotifyUserModel.bulkCreate(
          reminder.notifyUserIds.map((userId) => ({
            reminderId: reminder.id.toValue(),
            userId,
          })),
          { transaction: t },
        );
      }
    });
  }

  async delete(id: string): Promise<void> {
    // notify users deleted by cascade (or explicit destroy)
    await ReminderNotifyUserModel.destroy({ where: { reminderId: id } });
    await ReminderModel.destroy({ where: { id } });
  }
}
