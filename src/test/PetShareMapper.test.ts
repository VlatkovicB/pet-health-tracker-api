import 'reflect-metadata';
import { PetShareMapper } from '../infrastructure/mappers/PetShareMapper';
import type { PetShareDetails } from '../domain/share/PetShareDetails';

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
