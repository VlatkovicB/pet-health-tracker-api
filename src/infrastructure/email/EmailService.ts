import { Resend } from "resend";
import { Service } from "typedi";
import {
  MedicationReminderContext,
  medicationReminderHtml,
} from "./templates/medicationReminder";
import {
  VetVisitReminderContext,
  vetVisitReminderHtml,
} from "./templates/vetVisitReminder";

export type { MedicationReminderContext, VetVisitReminderContext };

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

@Service()
export class EmailService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);
  private readonly from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

  async send(opts: SendEmailOptions): Promise<void> {
    const to = Array.isArray(opts.to) ? opts.to : [opts.to];
    await this.resend.emails.send({
      from: this.from,
      to,
      subject: opts.subject,
      html: opts.html,
    });
  }

  async sendMedicationReminder(
    to: string,
    ctx: MedicationReminderContext,
  ): Promise<void> {
    await this.send({
      to,
      subject: `Medication reminder: ${ctx.medicationName} for ${ctx.petName}`,
      html: medicationReminderHtml(ctx),
    });
  }

  async sendVetVisitReminder(
    to: string,
    ctx: VetVisitReminderContext,
  ): Promise<void> {
    const when =
      ctx.daysUntil === 0
        ? "today"
        : ctx.daysUntil === 1
          ? "tomorrow"
          : `in ${ctx.daysUntil} days`;
    await this.send({
      to,
      subject: `Vet visit for ${ctx.petName} ${when}`,
      html: vetVisitReminderHtml(ctx),
    });
  }
}
