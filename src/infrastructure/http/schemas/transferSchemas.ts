import { z } from 'zod';

export const InitiateTransferSchema = z.object({
  email: z.string().email(),
});
export type InitiateTransferBody = z.infer<typeof InitiateTransferSchema>;

export const AcceptTransferSchema = z.object({
  retainAccessForOriginalOwner: z.boolean().optional(),
});
export type AcceptTransferBody = z.infer<typeof AcceptTransferSchema>;
