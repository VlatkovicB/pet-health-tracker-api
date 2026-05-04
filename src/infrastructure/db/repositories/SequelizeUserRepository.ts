import { Service } from 'typedi';
import { UserModel } from '../models/UserModel';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User, ThemeMode } from '../../../domain/user/User';
import { UserRole } from '../../../domain/user/UserRole';
import { PaginationParams, PaginatedResult } from '../../../shared/types/Pagination';
import { UserMapper } from '../../mappers/UserMapper';

@Service()
export class SequelizeUserRepository implements UserRepository {
  constructor(private readonly mapper: UserMapper) {}

  async findById(id: string): Promise<User | null> {
    const model = await UserModel.findByPk(id);
    return model ? this.mapper.toDomain(model) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    const models = await UserModel.findAll({ where: { id: ids } });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async findByEmail(email: string): Promise<User | null> {
    const model = await UserModel.findOne({ where: { email } });
    return model ? this.mapper.toDomain(model) : null;
  }

  async save(user: User): Promise<void> {
    await UserModel.upsert(this.mapper.toPersistence(user) as any);
  }

  async updateTheme(userId: string, theme: ThemeMode): Promise<void> {
    await UserModel.update({ theme }, { where: { id: userId } });
  }

  async updateRole(userId: string, role: UserRole): Promise<void> {
    await UserModel.update({ role }, { where: { id: userId } });
  }

  async findAllPaginated({ page, limit }: PaginationParams): Promise<PaginatedResult<User>> {
    const { count, rows } = await UserModel.findAndCountAll({
      limit,
      offset: (page - 1) * limit,
      order: [['created_at', 'ASC']],
    });
    return {
      items: rows.map((m) => this.mapper.toDomain(m)),
      total: count,
      nextPage: (page - 1) * limit + rows.length < count ? page + 1 : null,
    };
  }

  async deleteById(userId: string): Promise<void> {
    await UserModel.destroy({ where: { id: userId } });
  }
}
