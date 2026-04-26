import 'reflect-metadata';
import { PetShareMapper } from '../infrastructure/mappers/PetShareMapper';
import type { PetShareDetails } from '../domain/share/PetShareDetails';

describe('PetShareMapper.toResponse', () => {
  const mapper = new PetShareMapper();

  const details: PetShareDetails = {
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
    const result = mapper.toResponse(details);
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
});
