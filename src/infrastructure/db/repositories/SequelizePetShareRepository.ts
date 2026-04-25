// src/infrastructure/db/repositories/SequelizePetShareRepository.ts
import { Service } from 'typedi';
import { Op } from 'sequelize';
import { PetShareModel } from '../models/PetShareModel';
import { PetShareRepository } from '../../../domain/share/PetShareRepository';
import { PetShare } from '../../../domain/share/PetShare';
import { PetShareMapper } from '../../mappers/PetShareMapper';

@Service()
export class SequelizePetShareRepository implements PetShareRepository {
  constructor(private readonly mapper: PetShareMapper) {}

  async findById(id: string): Promise<PetShare | null> {
    const model = await PetShareModel.findByPk(id);
    return model ? this.mapper.toDomain(model) : null;
  }

  async findByPetId(petId: string): Promise<PetShare[]> {
    const models = await PetShareModel.findAll({ where: { petId } });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async findPendingForUser(userId: string): Promise<PetShare[]> {
    const models = await PetShareModel.findAll({
      where: { sharedWithUserId: userId, status: 'pending' },
    });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async findByPetIdAndEmail(petId: string, email: string): Promise<PetShare | null> {
    const model = await PetShareModel.findOne({
      where: { petId, invitedEmail: email, status: { [Op.ne]: 'declined' } },
    });
    return model ? this.mapper.toDomain(model) : null;
  }

  async findAcceptedByPetIdAndUserId(petId: string, userId: string): Promise<PetShare | null> {
    const model = await PetShareModel.findOne({
      where: { petId, sharedWithUserId: userId, status: 'accepted' },
    });
    return model ? this.mapper.toDomain(model) : null;
  }

  async findAcceptedForUser(userId: string): Promise<PetShare[]> {
    const models = await PetShareModel.findAll({
      where: { sharedWithUserId: userId, status: 'accepted' },
    });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async linkInvitedUser(email: string, userId: string): Promise<void> {
    await PetShareModel.update(
      { sharedWithUserId: userId },
      { where: { invitedEmail: email, sharedWithUserId: null } },
    );
  }

  async save(share: PetShare): Promise<void> {
    await PetShareModel.upsert(this.mapper.toPersistence(share) as any);
  }

  async delete(id: string): Promise<void> {
    await PetShareModel.destroy({ where: { id } });
  }
}
