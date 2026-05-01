import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { Sequelize, QueryTypes } from 'sequelize';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: false,
});

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function uploadFile(localPath: string, key: string): Promise<void> {
  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const mimeMap: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
  const contentType = mimeMap[ext] ?? 'image/jpeg';
  await r2.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key, Body: buffer, ContentType: contentType }));
}

async function run() {
  console.log('Starting image migration...');

  // Migrate vet visit images
  const visits = await sequelize.query<{ id: string; pet_id: string; owner_id: string; image_urls: string[] }>(
    `SELECT vv.id, vv.pet_id, p.user_id as owner_id, vv.image_urls FROM vet_visits vv JOIN pets p ON p.id = vv.pet_id WHERE array_length(vv.image_urls, 1) > 0`,
    { type: QueryTypes.SELECT }
  );

  for (const visit of visits) {
    for (const url of visit.image_urls) {
      const filename = url.split('/').pop()!;
      const localPath = path.join(process.cwd(), 'uploads', 'vet-visits', filename);
      if (!fs.existsSync(localPath)) { console.warn(`Skipping missing file: ${localPath}`); continue; }
      const s3Key = `photos/${filename}`;
      await uploadFile(localPath, s3Key);
      const takenAt = new Date().toISOString().slice(0, 10);
      await sequelize.query(
        `INSERT INTO photos (id, pet_id, owner_id, s3_key, taken_at, source_type, source_id, created_at) VALUES (:id, :petId, :ownerId, :s3Key, :takenAt, 'vet-visit', :sourceId, NOW()) ON CONFLICT DO NOTHING`,
        { replacements: { id: uuidv4(), petId: visit.pet_id, ownerId: visit.owner_id, s3Key, takenAt, sourceId: visit.id }, type: QueryTypes.INSERT }
      );
      console.log(`Migrated vet-visit image: ${filename}`);
    }
  }

  // Migrate note images
  const notes = await sequelize.query<{ id: string; user_id: string; image_urls: string[]; pet_ids: string[] }>(
    `SELECT n.id, n.user_id, n.image_urls, ARRAY(SELECT pet_id FROM note_pet_tags WHERE note_id = n.id) as pet_ids FROM notes n WHERE array_length(n.image_urls, 1) > 0`,
    { type: QueryTypes.SELECT }
  );

  for (const note of notes) {
    const petId = note.pet_ids[0];
    if (!petId) { console.warn(`Note ${note.id} has no pet tags — skipping images`); continue; }
    for (const url of note.image_urls) {
      const filename = url.split('/').pop()!;
      const localPath = path.join(process.cwd(), 'uploads', 'notes', filename);
      if (!fs.existsSync(localPath)) { console.warn(`Skipping missing file: ${localPath}`); continue; }
      const s3Key = `photos/${filename}`;
      await uploadFile(localPath, s3Key);
      await sequelize.query(
        `INSERT INTO photos (id, pet_id, owner_id, s3_key, taken_at, source_type, source_id, created_at) VALUES (:id, :petId, :ownerId, :s3Key, NOW()::date, 'note', :sourceId, NOW()) ON CONFLICT DO NOTHING`,
        { replacements: { id: uuidv4(), petId, ownerId: note.user_id, s3Key, sourceId: note.id }, type: QueryTypes.INSERT }
      );
      console.log(`Migrated note image: ${filename}`);
    }
  }

  console.log('Migration complete.');
  await sequelize.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
