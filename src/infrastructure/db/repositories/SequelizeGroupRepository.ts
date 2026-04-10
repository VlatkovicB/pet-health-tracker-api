import { Service } from 'typedi';
import { Op } from 'sequelize';
import { GroupModel } from '../models/GroupModel';
import { GroupMemberModel } from '../models/GroupMemberModel';
import { GroupRepository } from '../../../domain/group/GroupRepository';
import { Group } from '../../../domain/group/Group';
import { GroupMapper } from '../../mappers/GroupMapper';
import { PaginationParams, PaginatedResult } from '../../../shared/types/Pagination';

@Service()
export class SequelizeGroupRepository implements GroupRepository {
  constructor(private readonly mapper: GroupMapper) {}

  async findById(id: string): Promise<Group | null> {
    const model = await GroupModel.findByPk(id, { include: [GroupMemberModel] });
    return model ? this.mapper.toDomain(model) : null;
  }

  async findByUserId(userId: string, { page, limit }: PaginationParams): Promise<PaginatedResult<Group>> {
    const memberships = await GroupMemberModel.findAll({ where: { userId } });
    const groupIds = memberships.map((m) => m.groupId);
    if (!groupIds.length) return { items: [], total: 0, nextPage: null };

    const { count, rows } = await GroupModel.findAndCountAll({
      where: { id: { [Op.in]: groupIds } },
      include: [GroupMemberModel],
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

  async save(group: Group): Promise<void> {
    await GroupModel.upsert(this.mapper.toPersistence(group) as any);
    await GroupMemberModel.destroy({ where: { groupId: group.id.toValue() } });
    await GroupMemberModel.bulkCreate(this.mapper.membersForPersistence(group) as any[]);
  }

  async delete(id: string): Promise<void> {
    await GroupMemberModel.destroy({ where: { groupId: id } });
    await GroupModel.destroy({ where: { id } });
  }
}
