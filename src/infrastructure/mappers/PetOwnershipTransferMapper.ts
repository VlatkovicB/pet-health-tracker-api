// src/infrastructure/mappers/PetOwnershipTransferMapper.ts
import { Service } from 'typedi';
import { PetOwnershipTransferModel } from '../db/models/PetOwnershipTransferModel';
import { PetOwnershipTransfer, TransferStatus } from '../../domain/transfer/PetOwnershipTransfer';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface PetOwnershipTransferResponseDto {
  id: string;
  petId: string;
  fromUserId: string;
  toUserId: string | null;
  invitedEmail: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

@Service()
export class PetOwnershipTransferMapper {
  toDomain(model: PetOwnershipTransferModel): PetOwnershipTransfer {
    return PetOwnershipTransfer.reconstitute(
      {
        petId: model.petId,
        fromUserId: model.fromUserId,
        toUserId: model.toUserId,
        invitedEmail: model.invitedEmail,
        status: model.status as TransferStatus,
        expiresAt: model.expiresAt,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(transfer: PetOwnershipTransfer): object {
    return {
      id: transfer.id.toValue(),
      petId: transfer.petId,
      fromUserId: transfer.fromUserId,
      toUserId: transfer.toUserId,
      invitedEmail: transfer.invitedEmail,
      status: transfer.status,
      expiresAt: transfer.expiresAt,
      createdAt: transfer.createdAt,
    };
  }

  toResponse(transfer: PetOwnershipTransfer): PetOwnershipTransferResponseDto {
    return {
      id: transfer.id.toValue(),
      petId: transfer.petId,
      fromUserId: transfer.fromUserId,
      toUserId: transfer.toUserId,
      invitedEmail: transfer.invitedEmail,
      status: transfer.status,
      expiresAt: transfer.expiresAt.toISOString(),
      createdAt: transfer.createdAt.toISOString(),
    };
  }
}
