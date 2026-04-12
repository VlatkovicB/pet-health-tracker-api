import 'dotenv/config';
import 'reflect-metadata';
import { sequelize } from './infrastructure/db/database';
import { registerDependencies } from './container';
import { createApp } from './app';
import { NotificationWorker } from './infrastructure/queue/NotificationWorker';
import { EmailService } from './infrastructure/email/EmailService';
import { SequelizeUserRepository } from './infrastructure/db/repositories/SequelizeUserRepository';
import { Container } from 'typedi';

async function main(): Promise<void> {
  registerDependencies();

  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  console.log('Database connected');

  // Start BullMQ notification worker
  const emailService = Container.get(EmailService);
  const userRepository = Container.get(SequelizeUserRepository);
  new NotificationWorker(emailService, userRepository);
  console.log('Notification worker started');

  const app = createApp();
  const port = process.env.PORT ?? 3000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
