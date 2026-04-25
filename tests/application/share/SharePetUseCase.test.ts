import 'reflect-metadata';
import { SharePetUseCase } from '../../../src/application/share/SharePetUseCase';
import { PetAccessService } from '../../../src/application/pet/PetAccessService';
import { UserRepository } from '../../../src/domain/user/UserRepository';
import { PetShareRepository } from '../../../src/domain/share/PetShareRepository';
import { EmailService } from '../../../src/infrastructure/email/EmailService';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { AppError } from '../../../src/shared/errors/AppError';

const mockPet = Pet.reconstitute(
  { name: 'Rex', species: 'dog', userId: 'owner-1', createdAt: new Date() },
  new UniqueEntityId('pet-1'),
);

const basePermissions = {
  canViewVetVisits: true,
  canEditVetVisits: false,
  canViewMedications: false,
  canEditMedications: false,
  canViewNotes: false,
  canEditNotes: false,
};

function makeUseCase(existingShare: any = null, targetUser: any = null) {
  const petAccessService = { assertCanAccess: jest.fn().mockResolvedValue(mockPet) } as unknown as PetAccessService;
  const userRepo = { findByEmail: jest.fn().mockResolvedValue(targetUser) } as unknown as UserRepository;
  const shareRepo = {
    findByPetIdAndEmail: jest.fn().mockResolvedValue(existingShare),
    save: jest.fn().mockResolvedValue(undefined),
  } as unknown as PetShareRepository;
  const emailService = { send: jest.fn().mockResolvedValue(undefined) } as unknown as EmailService;
  return { useCase: new SharePetUseCase(petAccessService, userRepo, shareRepo, emailService), shareRepo, emailService };
}

describe('SharePetUseCase', () => {
  it('creates a share and sends notification when user exists', async () => {
    const targetUser = { id: new UniqueEntityId('user-2') };
    const { useCase, shareRepo, emailService } = makeUseCase(null, targetUser);
    await useCase.execute({ petId: 'pet-1', requestingUserId: 'owner-1', email: 'user@example.com', permissions: basePermissions });
    expect(shareRepo.save).toHaveBeenCalledTimes(1);
    expect(emailService.send).toHaveBeenCalledTimes(1);
  });

  it('creates a share and sends invite when user does not exist', async () => {
    const { useCase, shareRepo, emailService } = makeUseCase(null, null);
    await useCase.execute({ petId: 'pet-1', requestingUserId: 'owner-1', email: 'new@example.com', permissions: basePermissions });
    expect(shareRepo.save).toHaveBeenCalledTimes(1);
    expect(emailService.send).toHaveBeenCalledTimes(1);
  });

  it('throws 409 when pet already shared with that email', async () => {
    const existing = {};
    const { useCase } = makeUseCase(existing, null);
    await expect(
      useCase.execute({ petId: 'pet-1', requestingUserId: 'owner-1', email: 'user@example.com', permissions: basePermissions }),
    ).rejects.toThrow(AppError);
  });
});
