import { Service } from 'typedi';
import { WeightEntry } from '../../../domain/weight/WeightEntry';
import { WeightEntryRepository } from '../../../domain/weight/WeightEntryRepository';
import { WeightEntryModel } from '../models/WeightEntryModel';
import { WeightEntryMapper } from '../../mappers/WeightEntryMapper';

@Service()
export class SequelizeWeightEntryRepository implements WeightEntryRepository {
  constructor(private readonly mapper: WeightEntryMapper) {}

  async save(entry: WeightEntry): Promise<WeightEntry> {
    await WeightEntryModel.upsert(this.mapper.toPersistence(entry) as any);
    const saved = await this.findById(entry.id.toValue());
    if (!saved) throw new Error(`WeightEntry ${entry.id.toValue()} not found after save`);
    return saved;
  }

  async findById(id: string): Promise<WeightEntry | null> {
    const model = await WeightEntryModel.findByPk(id);
    return model ? this.mapper.toDomain(model) : null;
  }

  async findByPetId(petId: string): Promise<WeightEntry[]> {
    const models = await WeightEntryModel.findAll({
      where: { petId },
      order: [['date', 'DESC']],
    });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async delete(id: string): Promise<void> {
    await WeightEntryModel.destroy({ where: { id } });
  }
}
