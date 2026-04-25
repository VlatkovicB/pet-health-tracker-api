import { PetOwnershipTransfer } from './PetOwnershipTransfer';

export interface PetOwnershipTransferRepository {
  findById(id: string): Promise<PetOwnershipTransfer | null>;
  findActivePendingByPetId(petId: string): Promise<PetOwnershipTransfer | null>;
  findPendingForUser(userId: string): Promise<PetOwnershipTransfer[]>;
  linkInvitedUser(email: string, userId: string): Promise<void>;
  save(transfer: PetOwnershipTransfer): Promise<void>;
}

export const PET_OWNERSHIP_TRANSFER_REPOSITORY = 'PetOwnershipTransferRepository';
