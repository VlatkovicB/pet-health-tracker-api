import { Service } from 'typedi';
import { PetModel } from '../models/PetModel';
import { PetRepository } from '../../../domain/pet/PetRepository';
import { Pet } from '../../../domain/pet/Pet';
import { PetMapper } from '../../mappers/PetMapper';
import { PaginationParams, PaginatedResult } from '../../../shared/types/Pagination';

@Service()
export class SequelizePetRepository implements PetRepository {
  constructor(private readonly mapper: PetMapper) {}

  async findById(id: string): Promise<Pet | null> {
    const model = await PetModel.findByPk(id);
    return model ? this.mapper.toDomain(model) : null;
  }

  async findByUserId(userId: string, { page, limit }: PaginationParams): Promise<PaginatedResult<Pet>> {
    const { count, rows } = await PetModel.findAndCountAll({
      where: { userId },
      limit,
      offset: (page - 1) * limit,
    });
    const offset = (page - 1) * limit;
    return {
      items: rows.map((m) => this.mapper.toDomain(m)),
      total: count,
      nextPage: offset + rows.length < count ? page + 1 : null,
    };
  }

  async save(pet: Pet): Promise<void> {
    await PetModel.upsert(this.mapper.toPersistence(pet) as any);
  }

  async delete(id: string): Promise<void> {
    await PetModel.destroy({ where: { id } });
  }
}
