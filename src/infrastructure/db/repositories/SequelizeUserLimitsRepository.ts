import { Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';
import { UserLimitsModel } from '../models/UserLimitsModel';
import { UserLimitsRepository } from '../../../domain/user/UserLimitsRepository';
import { UserLimitsMapper } from '../../mappers/UserLimitsMapper';
import { UserLimits, UserLimitsProps } from '../../../domain/user/UserLimits';
import { ForbiddenError } from '../../../shared/errors/AppError';
import { sequelize } from '../database';

@Service()
export class SequelizeUserLimitsRepository implements UserLimitsRepository {
  constructor(private readonly mapper: UserLimitsMapper) {}

  async findByUserId(userId: string): Promise<UserLimits | null> {
    const model = await UserLimitsModel.findOne({ where: { userId } });
    return model ? this.mapper.toDomain(model) : null;
  }

  async upsert(userId: string, overrides: Partial<Pick<UserLimitsProps,
    'maxPets' | 'maxVets' | 'maxMedications' | 'maxNotes' |
    'maxStorageBytes' | 'maxPlacesSearchesMonthly'>>): Promise<void> {
    const now = new Date();
    const existing = await UserLimitsModel.findOne({ where: { userId } });
    if (existing) {
      await existing.update({ ...overrides, updatedAt: now });
    } else {
      await UserLimitsModel.create({
        id: uuidv4(),
        userId,
        ...overrides,
        storageUsedBytes: 0,
        placesSearchesThisMonth: 0,
        placesSearchesMonth: now.toISOString().slice(0, 10),
        createdAt: now,
        updatedAt: now,
      } as any);
    }
  }

  async incrementStorage(userId: string, bytes: number): Promise<void> {
    const now = new Date();
    const [row, created] = await UserLimitsModel.findOrCreate({
      where: { userId },
      defaults: {
        id: uuidv4(), userId, storageUsedBytes: 0,
        placesSearchesThisMonth: 0,
        placesSearchesMonth: now.toISOString().slice(0, 10),
        createdAt: now, updatedAt: now,
      } as any,
    });
    if (created) {
      await row.update({ storageUsedBytes: bytes, updatedAt: now });
    } else {
      await UserLimitsModel.increment('storageUsedBytes', { by: bytes, where: { userId } });
    }
  }

  async decrementStorage(userId: string, bytes: number): Promise<void> {
    await UserLimitsModel.decrement('storageUsedBytes', { by: bytes, where: { userId } });
  }

  async checkAndIncrementPlacesSearch(userId: string, effectiveLimit: number): Promise<void> {
    await sequelize.transaction(async (t) => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      let row = await UserLimitsModel.findOne({ where: { userId }, transaction: t, lock: true });

      if (!row) {
        const now = new Date();
        row = await UserLimitsModel.create({
          id: uuidv4(), userId, storageUsedBytes: 0,
          placesSearchesThisMonth: 0,
          placesSearchesMonth: now.toISOString().slice(0, 10),
          createdAt: now, updatedAt: now,
        } as any, { transaction: t });
      }

      const rowMonth = row.placesSearchesMonth.slice(0, 7);
      if (rowMonth !== currentMonth) {
        await row.update(
          { placesSearchesThisMonth: 0, placesSearchesMonth: new Date().toISOString().slice(0, 10) },
          { transaction: t },
        );
        row.placesSearchesThisMonth = 0;
      }

      if (row.placesSearchesThisMonth >= effectiveLimit) {
        throw new ForbiddenError(`Monthly Places search limit reached (${effectiveLimit}/month)`);
      }

      await row.increment('placesSearchesThisMonth', { by: 1, transaction: t });
    });
  }
}
