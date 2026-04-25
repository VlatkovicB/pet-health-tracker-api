import 'reflect-metadata';
import { PetOwnershipTransfer } from '../../src/domain/transfer/PetOwnershipTransfer';

const base = {
  petId: 'pet-1',
  fromUserId: 'owner-1',
  toUserId: 'user-2',
  invitedEmail: 'user@example.com',
};

describe('PetOwnershipTransfer', () => {
  it('creates with pending status and 7-day expiry', () => {
    const transfer = PetOwnershipTransfer.create(base);
    expect(transfer.status).toBe('pending');
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(transfer.expiresAt.getTime() - Date.now()).toBeCloseTo(sevenDays, -3);
  });

  it('cancel() sets status to cancelled', () => {
    const transfer = PetOwnershipTransfer.create(base);
    transfer.cancel();
    expect(transfer.status).toBe('cancelled');
  });

  it('expire() sets status to expired', () => {
    const transfer = PetOwnershipTransfer.create(base);
    transfer.expire();
    expect(transfer.status).toBe('expired');
  });

  it('accept() sets status to accepted', () => {
    const transfer = PetOwnershipTransfer.create(base);
    transfer.accept();
    expect(transfer.status).toBe('accepted');
  });

  it('decline() sets status to declined', () => {
    const transfer = PetOwnershipTransfer.create(base);
    transfer.decline();
    expect(transfer.status).toBe('declined');
  });

  it('linkRecipient() sets toUserId', () => {
    const transfer = PetOwnershipTransfer.create({ ...base, toUserId: null });
    transfer.linkRecipient('new-user-id');
    expect(transfer.toUserId).toBe('new-user-id');
  });
});
