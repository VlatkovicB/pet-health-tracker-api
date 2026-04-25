export interface PetTransferInviteContext {
  petName: string;
}

export function petTransferInviteHtml(ctx: PetTransferInviteContext): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You've been offered ownership of ${ctx.petName}</h2>
      <p>Someone wants to transfer ownership of their pet to you on Pet Health Tracker.</p>
      <p>Create an account to accept or decline the transfer. This offer expires in 7 days.</p>
      <a href="${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}/register"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">
        Create Account
      </a>
    </div>
  `;
}
