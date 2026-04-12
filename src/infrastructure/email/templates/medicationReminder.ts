export interface MedicationReminderContext {
  recipientName: string;
  petName: string;
  medicationName: string;
  dosage: string;
}

export function medicationReminderHtml(ctx: MedicationReminderContext): string {
  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px 24px; border-radius: 8px;">
        <h2 style="margin: 0 0 4px; font-size: 18px; color: #15803d;">Medication Reminder</h2>
        <p style="margin: 0; color: #166534; font-size: 14px;">Time to give ${ctx.petName} their medication</p>
      </div>

      <div style="padding: 24px 0;">
        <p style="margin: 0 0 16px;">Hi ${ctx.recipientName},</p>
        <p style="margin: 0 0 20px;">This is a reminder to administer the following medication:</p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; width: 40%;">Pet</td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${ctx.petName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600;">Medication</td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${ctx.medicationName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600;">Dosage</td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${ctx.dosage}</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        Sent by Pet Health Tracker · You are receiving this because you are a group member.
      </p>
    </div>
  `;
}
