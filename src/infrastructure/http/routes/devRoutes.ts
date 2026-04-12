import { Router, Request, Response } from "express";
import { Container } from "typedi";
import { EmailService } from "../../email/EmailService";

export function devRoutes(): Router {
  const router = Router();

  /**
   * POST /api/v1/dev/test-email/vet-visit
   * Body: { to?: string }   — defaults to DEV_TEST_EMAIL env var
   *
   * Sends a realistic test vet visit reminder email.
   * Only mounted when NODE_ENV !== 'production'.
   */
  router.post("/test-email/vet-visit", async (req: Request, res: Response) => {
    const emailService = Container.get(EmailService);
    const to: string =
      req.body.to ?? process.env.DEV_TEST_EMAIL ?? "bojanvlatkovic@gmail.com";

    const nextVisitDate = new Date();
    nextVisitDate.setDate(nextVisitDate.getDate() + 2);

    await emailService.sendVetVisitReminder(to, {
      recipientName: "Alex",
      petName: "Whiskers",
      reason: "Recheck eye ulcer",
      nextVisitDate: nextVisitDate.toISOString(),
      vetName: "Dr. Sarah Mitchell",
      clinic: "City Cat Clinic",
      daysUntil: 2,
    });

    res.json({ ok: true, sentTo: to });
  });

  return router;
}
