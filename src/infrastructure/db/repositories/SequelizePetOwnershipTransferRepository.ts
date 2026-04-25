// src/infrastructure/db/repositories/SequelizePetOwnershipTransferRepository.ts
import { Service } from 'typedi';
import { PetOwnershipTransferModel } from '../models/PetOwnershipTransferModel';
import { PetOwnershipTransferRepository } from '../../../domain/transfer/PetOwnershipTransferRepository';
import { PetOwnershipTransfer } from '../../../domain/transfer/PetOwnershipTransfer';
import { PetOwnershipTransferMapper } from '../../mappers/PetOwnershipTransferMapper';

@Service()
export class SequelizePetOwnershipTransferRepository implements PetOwnershipTransferRepository {
  constructor(private readonly mapper: PetOwnershipTransferMapper) {}

  async findById(id: string): Promise<PetOwnershipTransfer | null> {
    const model = await PetOwnershipTransferModel.findByPk(id);
    return model ? this.mapper.toDomain(model) : null;
  }

  async findActivePendingByPetId(petId: string): Promise<PetOwnershipTransfer | null> {
    const model = await PetOwnershipTransferModel.findOne({
      where: { petId, status: 'pending' },
    });
    return model ? this.mapper.toDomain(model) : null;
  }

  async findPendingForUser(userId: string): Promise<PetOwnershipTransfer[]> {
    const models = await PetOwnershipTransferModel.findAll({
      where: { toUserId: userId, status: 'pending' },
    });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async linkInvitedUser(email: string, userId: string): Promise<void> {
    await PetOwnershipTransferModel.update(
      { toUserId: userId },
      { where: { invitedEmail: email, toUserId: null, status: 'pending' } },
    );
  }

  async save(transfer: PetOwnershipTransfer): Promise<void> {
    await PetOwnershipTransferModel.upsert(this.mapper.toPersistence(transfer) as any);
  }
}
