export interface PetShareInviteContext {
  petName: string;
}

export function petShareInviteHtml(ctx: PetShareInviteContext): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You've been invited to care for ${ctx.petName}</h2>
      <p>Someone has shared their pet with you on Pet Health Tracker.</p>
      <p>Create an account to accept the invitation and view ${ctx.petName}'s health records.</p>
      <a href="${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}/register"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">
        Create Account
      </a>
    </div>
  `;
}
