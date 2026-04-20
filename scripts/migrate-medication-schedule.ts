/**
 * One-time migration: backfill medications.schedule JSONB from legacy
 * frequency_type / frequency_interval columns.
 *
 * Run ONCE before starting the app after the model change:
 *   pnpm ts-node -r dotenv/config --project tsconfig.json scripts/migrate-medication-schedule.ts
 */
import 'reflect-metadata';
import { Sequelize, QueryTypes } from 'sequelize';

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'pet_health_tracker',
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  logging: false,
});

async function migrate(): Promise<void> {
  await sequelize.authenticate();

  const rows = await sequelize.query<{ id: string; frequency_type: string }>(
    `SELECT id, frequency_type FROM medications WHERE schedule IS NULL`,
    { type: QueryTypes.SELECT },
  );

  console.log(`Backfilling schedule for ${rows.length} medications...`);

  for (const row of rows) {
    let schedule: object;
    switch (row.frequency_type) {
      case 'weekly':
        schedule = { type: 'weekly', days: ['MON'], times: ['08:00'] };
        break;
      case 'monthly':
        schedule = { type: 'monthly', daysOfMonth: [1], times: ['08:00'] };
        break;
      default: // daily, hourly → daily
        schedule = { type: 'daily', times: ['08:00'] };
    }

    await sequelize.query(
      `UPDATE medications SET schedule = :schedule WHERE id = :id`,
      { replacements: { schedule: JSON.stringify(schedule), id: row.id }, type: QueryTypes.UPDATE },
    );
  }

  console.log('Done. Old frequency_type / frequency_interval columns remain in DB and can be dropped manually.');
  await sequelize.close();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
