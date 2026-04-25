import 'reflect-metadata';
import { PetShare } from '../../src/domain/share/PetShare';

const base = {
  petId: 'pet-1',
  ownerId: 'owner-1',
  sharedWithUserId: 'user-1',
  invitedEmail: 'user@example.com',
  canViewVetVisits: false,
  canEditVetVisits: false,
  canViewMedications: false,
  canEditMedications: false,
  canViewNotes: false,
  canEditNotes: false,
};

describe('PetShare', () => {
  it('creates with pending status', () => {
    const share = PetShare.create(base);
    expect(share.status).toBe('pending');
  });

  it('accept() sets status to accepted', () => {
    const share = PetShare.create(base);
    share.accept();
    expect(share.status).toBe('accepted');
  });

  it('hasPermission("owner") always returns false', () => {
    const share = PetShare.create({ ...base, canViewVetVisits: true });
    expect(share.hasPermission('owner')).toBe(false);
  });

  it('hasPermission("view_pet") returns true for accepted share', () => {
    const share = PetShare.create(base);
    share.accept();
    expect(share.hasPermission('view_pet')).toBe(true);
  });

  it('canEdit grants canView automatically', () => {
    const share = PetShare.create({ ...base, canEditVetVisits: true });
    share.accept();
    expect(share.hasPermission('view_vet_visits')).toBe(true);
    expect(share.hasPermission('edit_vet_visits')).toBe(true);
  });

  it('canView alone does not grant canEdit', () => {
    const share = PetShare.create({ ...base, canViewVetVisits: true });
    share.accept();
    expect(share.hasPermission('view_vet_visits')).toBe(true);
    expect(share.hasPermission('edit_vet_visits')).toBe(false);
  });

  it('hasPermission returns false when permission not granted', () => {
    const share = PetShare.create(base);
    share.accept();
    expect(share.hasPermission('view_medications')).toBe(false);
  });

  it('hasPermission returns false for pending share', () => {
    const share = PetShare.create({ ...base, canViewVetVisits: true });
    // status is 'pending' — not accepted yet
    expect(share.hasPermission('view_pet')).toBe(false);
    expect(share.hasPermission('view_vet_visits')).toBe(false);
  });

  it('updatePermissions changes hasPermission results', () => {
    const share = PetShare.create(base);
    share.accept();
    expect(share.hasPermission('view_medications')).toBe(false);
    share.updatePermissions({ ...base, canViewMedications: true });
    expect(share.hasPermission('view_medications')).toBe(true);
  });

  it('linkUser sets sharedWithUserId', () => {
    const share = PetShare.create({ ...base, sharedWithUserId: null });
    share.linkUser('new-user-id');
    expect(share.sharedWithUserId).toBe('new-user-id');
  });
});
