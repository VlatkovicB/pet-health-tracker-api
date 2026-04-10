import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function makeStorage(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
}

function fileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) cb(null, true);
  else cb(new Error('Only image files are allowed'));
}

const limits = { fileSize: 10 * 1024 * 1024 };

export const uploadImage = multer({
  storage: makeStorage(path.join(process.cwd(), 'uploads', 'vet-visits')),
  fileFilter,
  limits,
});

export const uploadPetPhoto = multer({
  storage: makeStorage(path.join(process.cwd(), 'uploads', 'pets')),
  fileFilter,
  limits,
});
