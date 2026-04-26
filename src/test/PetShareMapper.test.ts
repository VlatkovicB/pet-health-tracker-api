import 'reflect-metadata';
import { PetShareMapper } from '../infrastructure/mappers/PetShareMapper';
import type { PetShareDetails } from '../domain/share/PetShareDetails';
import { PetShare } from '../domain/share/PetShare';
import { UniqueEntityId } from '../domain/shared/UniqueEntityId';

describe('PetShareMapper.toResponse', () => {
  const mapper = new PetShareMapper();

  const baseDetails: PetShareDetails = {
    id: 'abc-123',
    petId: 'pet-456',
    petName: 'Luna',
    petSpecies: 'cat',
    sharedByEmail: 'owner@example.com',
    status: 'pending',
    permissions: {
      canViewVetVisits: true,
      canEditVetVisits: false,
      canViewMedications: true,
      canEditMedications: true,
      canViewNotes: false,
      canEditNotes: false,
    },
    createdAt: new Date('2026-04-20T10:00:00.000Z'),
  };

  it('maps all fields to the response DTO', () => {
    const result = mapper.toResponse(baseDetails);
    expect(result).toEqual({
      id: 'abc-123',
      petId: 'pet-456',
      petName: 'Luna',
      petSpecies: 'cat',
      sharedByEmail: 'owner@example.com',
      status: 'pending',
      permissions: {
        canViewVetVisits: true,
        canEditVetVisits: false,
        canViewMedications: true,
        canEditMedications: true,
        canViewNotes: false,
        canEditNotes: false,
      },
      createdAt: '2026-04-20T10:00:00.000Z',
    });
  });

  it('correctly serialises a non-UTC-midnight createdAt to ISO string', () => {
    const details: PetShareDetails = { ...baseDetails, createdAt: new Date('2026-04-20T15:30:45.123Z') };
    const result = mapper.toResponse(details);
    expect(result.createdAt).toBe('2026-04-20T15:30:45.123Z');
  });

  it('preserves accepted status', () => {
    const details: PetShareDetails = { ...baseDetails, status: 'accepted' };
    const result = mapper.toResponse(details);
    expect(result.status).toBe('accepted');
  });
});

describe('PetShareMapper.toOwnerResponse', () => {
  const mapper = new PetShareMapper();

  it('maps invitedEmail to sharedWithEmail in the response', () => {
    // Build a minimal PetShare domain entity
    const share = PetShare.reconstitute(
      {
        petId: 'pet-111',
        ownerId: 'owner-222',
        sharedWithUserId: 'user-333',
        invitedEmail: 'recipient@example.com',
        status: 'pending',
        canViewVetVisits: true,
        canEditVetVisits: false,
        canViewMedications: false,
        canEditMedications: false,
        canViewNotes: true,
        canEditNotes: true,
        createdAt: new Date('2026-04-21T08:00:00.000Z'),
      },
      new UniqueEntityId('share-444'),
    );

    const result = mapper.toOwnerResponse(share);
    expect(result.sharedWithEmail).toBe('recipient@example.com');
    expect(result.id).toBe('share-444');
    expect(result.petId).toBe('pet-111');
    expect(result.status).toBe('pending');
    expect(result.createdAt).toBe('2026-04-21T08:00:00.000Z');
    expect(result.permissions.canViewVetVisits).toBe(true);
    expect(result.permissions.canEditVetVisits).toBe(false);
  });
});
