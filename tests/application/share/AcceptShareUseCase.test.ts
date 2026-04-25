import 'reflect-metadata';
import { AcceptShareUseCase } from '../../../src/application/share/AcceptShareUseCase';
import { PetShareRepository } from '../../../src/domain/share/PetShareRepository';
import { PetShare } from '../../../src/domain/share/PetShare';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError } from '../../../src/shared/errors/AppError';

function makeShare(userId: string): PetShare {
  return PetShare.reconstitute(
    {
      petId: 'pet-1', ownerId: 'owner-1', sharedWithUserId: userId,
      invitedEmail: 'user@example.com', status: 'pending',
      canViewVetVisits: false, canEditVetVisits: false,
      canViewMedications: false, canEditMedications: false,
      canViewNotes: false, canEditNotes: false,
      createdAt: new Date(),
    },
    new UniqueEntityId('share-1'),
  );
}

describe('AcceptShareUseCase', () => {
  it('accepts the share and saves it', async () => {
    const share = makeShare('user-2');
    const shareRepo = { findById: jest.fn().mockResolvedValue(share), save: jest.fn() } as unknown as PetShareRepository;
    const useCase = new AcceptShareUseCase(shareRepo);
    await useCase.execute('share-1', 'user-2');
    expect(share.status).toBe('accepted');
    expect(shareRepo.save).toHaveBeenCalledWith(share);
  });

  it('throws NotFoundError when share not found', async () => {
    const shareRepo = { findById: jest.fn().mockResolvedValue(null) } as unknown as PetShareRepository;
    const useCase = new AcceptShareUseCase(shareRepo);
    await expect(useCase.execute('share-1', 'user-2')).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when share belongs to different user', async () => {
    const share = makeShare('user-2');
    const shareRepo = { findById: jest.fn().mockResolvedValue(share) } as unknown as PetShareRepository;
    const useCase = new AcceptShareUseCase(shareRepo);
    await expect(useCase.execute('share-1', 'user-99')).rejects.toThrow(ForbiddenError);
  });
});
