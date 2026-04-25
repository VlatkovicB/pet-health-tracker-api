export interface PetShareNotificationContext {
  petName: string;
}

export function petShareNotificationHtml(ctx: PetShareNotificationContext): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${ctx.petName} has been shared with you</h2>
      <p>Log in to accept the share invitation and view ${ctx.petName}'s health records.</p>
      <a href="${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}/login"
         style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">
        Log In
      </a>
    </div>
  `;
}
