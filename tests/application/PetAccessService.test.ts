import 'reflect-metadata';
import { PetAccessService } from '../../src/application/pet/PetAccessService';
import { PetRepository } from '../../src/domain/pet/PetRepository';
import { PetShareRepository } from '../../src/domain/share/PetShareRepository';
import { Pet } from '../../src/domain/pet/Pet';
import { PetShare } from '../../src/domain/share/PetShare';
import { UniqueEntityId } from '../../src/domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError } from '../../src/shared/errors/AppError';

function makePet(userId: string): Pet {
  return Pet.reconstitute(
    { name: 'Rex', species: 'dog', userId, createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeShare(overrides: Partial<Parameters<typeof PetShare.create>[0]> = {}): PetShare {
  const share = PetShare.create({
    petId: 'pet-1',
    ownerId: 'owner-1',
    sharedWithUserId: 'user-2',
    invitedEmail: 'user@example.com',
    canViewVetVisits: false,
    canEditVetVisits: false,
    canViewMedications: false,
    canEditMedications: false,
    canViewNotes: false,
    canEditNotes: false,
    ...overrides,
  });
  share.accept();
  return share;
}

function makeService(pet: Pet | null, share: PetShare | null): PetAccessService {
  const petRepo = { findById: jest.fn().mockResolvedValue(pet) } as unknown as PetRepository;
  const shareRepo = {
    findAcceptedByPetIdAndUserId: jest.fn().mockResolvedValue(share),
  } as unknown as PetShareRepository;
  return new PetAccessService(petRepo, shareRepo);
}

describe('PetAccessService', () => {
  it('throws NotFoundError when pet does not exist', async () => {
    const svc = makeService(null, null);
    await expect(svc.assertCanAccess('pet-1', 'user-1', 'view_pet')).rejects.toThrow(NotFoundError);
  });

  it('allows owner for any permission', async () => {
    const pet = makePet('owner-1');
    const svc = makeService(pet, null);
    await expect(svc.assertCanAccess('pet-1', 'owner-1', 'owner')).resolves.toBe(pet);
    await expect(svc.assertCanAccess('pet-1', 'owner-1', 'edit_vet_visits')).resolves.toBe(pet);
  });

  it('throws ForbiddenError when no accepted share exists', async () => {
    const pet = makePet('owner-1');
    const svc = makeService(pet, null);
    await expect(svc.assertCanAccess('pet-1', 'user-2', 'view_pet')).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when sharer requests owner permission', async () => {
    const pet = makePet('owner-1');
    const share = makeShare();
    const svc = makeService(pet, share);
    await expect(svc.assertCanAccess('pet-1', 'user-2', 'owner')).rejects.toThrow(ForbiddenError);
  });

  it('allows sharer with correct permission', async () => {
    const pet = makePet('owner-1');
    const share = makeShare({ canViewVetVisits: true });
    const svc = makeService(pet, share);
    await expect(svc.assertCanAccess('pet-1', 'user-2', 'view_vet_visits')).resolves.toBe(pet);
  });

  it('denies sharer without required permission', async () => {
    const pet = makePet('owner-1');
    const share = makeShare({ canViewVetVisits: false });
    const svc = makeService(pet, share);
    await expect(svc.assertCanAccess('pet-1', 'user-2', 'view_vet_visits')).rejects.toThrow(ForbiddenError);
  });
});
