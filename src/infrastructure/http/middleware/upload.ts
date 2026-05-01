import multer from 'multer';
import { AppError } from '../../../shared/errors/AppError';

export function detectMimeType(buffer: Buffer): string | null {
  const hex4 = buffer.slice(0, 4).toString('hex');
  if (hex4.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex4 === '89504e47') return 'image/png';
  if (hex4 === '47494638') return 'image/gif';
  // WebP: RIFF????WEBP
  if (hex4 === '52494646' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export function validateImageBuffer(buffer: Buffer): string {
  const mimeType = detectMimeType(buffer);
  if (!mimeType) throw new AppError('Unsupported image type. Allowed: jpeg, png, gif, webp', 415);
  return mimeType;
}

const memoryStorage = multer.memoryStorage();
const limits = { fileSize: 10 * 1024 * 1024 };

export const uploadImage = multer({ storage: memoryStorage, limits });
export const uploadPetPhoto = multer({ storage: memoryStorage, limits });
export const uploadNoteImage = multer({ storage: memoryStorage, limits });
