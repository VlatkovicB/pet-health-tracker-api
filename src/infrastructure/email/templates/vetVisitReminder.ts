export interface VetVisitReminderContext {
  recipientName: string;
  petName: string;
  reason: string;
  nextVisitDate: string; // ISO string
  vetName?: string;
  clinic?: string;
  daysUntil: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function urgencyLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} day${days !== 1 ? 's' : ''}`;
}

export function vetVisitReminderHtml(ctx: VetVisitReminderContext): string {
  const location = ctx.vetName ?? ctx.clinic ?? null;
  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px 24px; border-radius: 8px;">
        <h2 style="margin: 0 0 4px; font-size: 18px; color: #1d4ed8;">Upcoming Vet Visit</h2>
        <p style="margin: 0; color: #1e40af; font-size: 14px;">${urgencyLabel(ctx.daysUntil)} — ${formatDate(ctx.nextVisitDate)}</p>
      </div>

      <div style="padding: 24px 0;">
        <p style="margin: 0 0 16px;">Hi ${ctx.recipientName},</p>
        <p style="margin: 0 0 20px;">
          ${ctx.petName} has a vet visit coming up. Here are the details:
        </p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; width: 40%;">Pet</td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${ctx.petName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600;">Visit Date</td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${formatDate(ctx.nextVisitDate)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600;">Reason</td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${ctx.reason}</td>
          </tr>
          ${location ? `
          <tr>
            <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600;">Vet / Clinic</td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${location}</td>
          </tr>` : ''}
        </table>
      </div>

      <p style="font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        Sent by Pet Health Tracker · You are receiving this because you have a scheduled reminder set up in Pet Health Tracker.
      </p>
    </div>
  `;
}
