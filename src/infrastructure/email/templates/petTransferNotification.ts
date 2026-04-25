export interface PetTransferNotificationContext {
  petName: string;
}

export function petTransferNotificationHtml(ctx: PetTransferNotificationContext): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Ownership transfer request for ${ctx.petName}</h2>
      <p>You have a pending ownership transfer request. This offer expires in 7 days.</p>
      <a href="${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}/pet-ownership-transfers"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">
        Review Transfer
      </a>
    </div>
  `;
}
