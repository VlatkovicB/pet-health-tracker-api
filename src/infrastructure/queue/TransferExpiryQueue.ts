import { Queue } from 'bullmq';
import { redis } from './redis';

export interface TransferExpiryJobData {
  transferId: string;
}

export const TRANSFER_EXPIRY_QUEUE_NAME = 'transfer-expiry';

export const transferExpiryQueue = new Queue<TransferExpiryJobData>(TRANSFER_EXPIRY_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 50 },
});

export async function scheduleTransferExpiry(transferId: string, expiresAt: Date): Promise<void> {
  const delay = Math.max(0, expiresAt.getTime() - Date.now());
  await transferExpiryQueue.add(
    'expire-transfer',
    { transferId },
    { delay, jobId: `transfer--${transferId}` },
  );
}
