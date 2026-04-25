import 'reflect-metadata';
import { AcceptOwnershipTransferUseCase } from '../../../src/application/transfer/AcceptOwnershipTransferUseCase';
import { PetOwnershipTransferRepository } from '../../../src/domain/transfer/PetOwnershipTransferRepository';
import { PetRepository } from '../../../src/domain/pet/PetRepository';
import { PetShareRepository } from '../../../src/domain/share/PetShareRepository';
import { PetOwnershipTransfer } from '../../../src/domain/transfer/PetOwnershipTransfer';
import { Pet } from '../../../src/domain/pet/Pet';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';
import { ForbiddenError, NotFoundError } from '../../../src/shared/errors/AppError';

function makeTransfer(toUserId: string): PetOwnershipTransfer {
  return PetOwnershipTransfer.reconstitute(
    {
      petId: 'pet-1', fromUserId: 'owner-1', toUserId,
      invitedEmail: 'new@example.com', status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 86400000), createdAt: new Date(),
    },
    new UniqueEntityId('transfer-1'),
  );
}

function makePet(): Pet {
  return Pet.reconstitute(
    { name: 'Rex', species: 'dog', userId: 'owner-1', createdAt: new Date() },
    new UniqueEntityId('pet-1'),
  );
}

function makeUseCase(transfer: PetOwnershipTransfer | null, pet: Pet | null) {
  const transferRepo = { findById: jest.fn().mockResolvedValue(transfer), save: jest.fn() } as unknown as PetOwnershipTransferRepository;
  const petRepo = { findById: jest.fn().mockResolvedValue(pet), save: jest.fn() } as unknown as PetRepository;
  const shareRepo = { save: jest.fn() } as unknown as PetShareRepository;
  return { useCase: new AcceptOwnershipTransferUseCase(transferRepo, petRepo, shareRepo), transferRepo, petRepo, shareRepo };
}

describe('AcceptOwnershipTransferUseCase', () => {
  it('transfers ownership and accepts transfer', async () => {
    const transfer = makeTransfer('user-2');
    const pet = makePet();
    const { useCase, petRepo, transferRepo } = makeUseCase(transfer, pet);
    await useCase.execute('transfer-1', 'user-2', false);
    expect(pet.userId).toBe('user-2');
    expect(transfer.status).toBe('accepted');
    expect(petRepo.save).toHaveBeenCalledWith(pet);
    expect(transferRepo.save).toHaveBeenCalledWith(transfer);
  });

  it('creates share for original owner when retainAccess=true', async () => {
    const transfer = makeTransfer('user-2');
    const pet = makePet();
    const { useCase, shareRepo } = makeUseCase(transfer, pet);
    await useCase.execute('transfer-1', 'user-2', true);
    expect(shareRepo.save).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError when transfer not found', async () => {
    const { useCase } = makeUseCase(null, null);
    await expect(useCase.execute('transfer-1', 'user-2', false)).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when wrong user accepts', async () => {
    const transfer = makeTransfer('user-2');
    const pet = makePet();
    const { useCase } = makeUseCase(transfer, pet);
    await expect(useCase.execute('transfer-1', 'user-99', false)).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when toUserId is null (invite not yet linked)', async () => {
    const transfer = PetOwnershipTransfer.reconstitute(
      {
        petId: 'pet-1', fromUserId: 'owner-1', toUserId: null,
        invitedEmail: 'new@example.com', status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 86400000), createdAt: new Date(),
      },
      new UniqueEntityId('transfer-1'),
    );
    const pet = makePet();
    const { useCase } = makeUseCase(transfer, pet);
    await expect(useCase.execute('transfer-1', 'user-2', false)).rejects.toThrow(ForbiddenError);
  });
});
