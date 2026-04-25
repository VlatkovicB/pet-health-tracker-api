import { Worker } from 'bullmq';
import { Container } from 'typedi';
import { redis } from './redis';
import { TRANSFER_EXPIRY_QUEUE_NAME, TransferExpiryJobData } from './TransferExpiryQueue';
import { ExpireOwnershipTransferUseCase } from '../../application/transfer/ExpireOwnershipTransferUseCase';

export function createTransferExpiryWorker(): Worker<TransferExpiryJobData> {
  const worker = new Worker<TransferExpiryJobData>(
    TRANSFER_EXPIRY_QUEUE_NAME,
    async (job) => {
      const useCase = Container.get(ExpireOwnershipTransferUseCase);
      await useCase.execute(job.data.transferId);
    },
    { connection: redis },
  );

  worker.on('failed', (job, err) => {
    console.error(`TransferExpiry job ${job?.id} failed:`, err.message);
  });

  return worker;
}
