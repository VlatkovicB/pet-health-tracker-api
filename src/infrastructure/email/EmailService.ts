import nodemailer from 'nodemailer';
import { Service } from 'typedi';

interface MedicationReminderOptions {
  to: string;
  recipientName: string;
  petName: string;
  medicationName: string;
  dosage: string;
}

@Service()
export class EmailService {
  private readonly transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  async sendMedicationReminder(opts: MedicationReminderOptions): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: opts.to,
      subject: `Medication reminder: ${opts.medicationName} for ${opts.petName}`,
      html: this.medicationReminderTemplate(opts),
    });
  }

  private medicationReminderTemplate(opts: MedicationReminderOptions): string {
    return `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Medication Reminder</h2>
        <p>Hi ${opts.recipientName},</p>
        <p>This is a reminder to give <strong>${opts.petName}</strong> their medication:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #eee; font-weight: bold;">Medication</td>
            <td style="padding: 8px; border: 1px solid #eee;">${opts.medicationName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #eee; font-weight: bold;">Dosage</td>
            <td style="padding: 8px; border: 1px solid #eee;">${opts.dosage}</td>
          </tr>
        </table>
        <p style="color: #888; font-size: 12px;">Sent by Pet Health Tracker</p>
      </div>
    `;
  }
}
