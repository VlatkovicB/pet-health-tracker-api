import { PetShare } from './PetShare';
import { PetShareDetails } from './PetShareDetails';

export interface PetShareRepository {
  findById(id: string): Promise<PetShare | null>;
  findByPetId(petId: string): Promise<PetShare[]>;
  findPendingForUser(userId: string): Promise<PetShare[]>;
  findPendingForUserWithDetails(userId: string): Promise<PetShareDetails[]>;
  findByPetIdAndEmail(petId: string, email: string): Promise<PetShare | null>;
  findAcceptedByPetIdAndUserId(petId: string, userId: string): Promise<PetShare | null>;
  findAcceptedForUser(userId: string): Promise<PetShare[]>;
  linkInvitedUser(email: string, userId: string): Promise<void>;
  save(share: PetShare): Promise<void>;
  delete(id: string): Promise<void>;
}

export const PET_SHARE_REPOSITORY = 'PetShareRepository';
