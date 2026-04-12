import { Service } from 'typedi';
import { VetModel } from '../models/VetModel';
import { VetRepository } from '../../../domain/vet/VetRepository';
import { Vet } from '../../../domain/vet/Vet';
import { VetMapper } from '../../mappers/VetMapper';
import { PaginationParams, PaginatedResult } from '../../../shared/types/Pagination';

@Service()
export class SequelizeVetRepository implements VetRepository {
  constructor(private readonly mapper: VetMapper) {}

  async findById(id: string): Promise<Vet | null> {
    const model = await VetModel.findByPk(id);
    return model ? this.mapper.toDomain(model) : null;
  }

  async findByUserId(userId: string, { page, limit }: PaginationParams): Promise<PaginatedResult<Vet>> {
    const { count, rows } = await VetModel.findAndCountAll({
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

  async save(vet: Vet): Promise<void> {
    await VetModel.upsert(this.mapper.toPersistence(vet) as any);
  }
}
