import { Service } from 'typedi';
import { UserModel } from '../models/UserModel';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User, ThemeMode } from '../../../domain/user/User';
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
}
