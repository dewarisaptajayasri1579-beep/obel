import { BadRequestException, FileTypeValidator, MaxFileSizeValidator, ParseFilePipe } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Request } from 'express';

const MAKS_UKURAN = 5 * 1024 * 1024;
const TIPE_GAMBAR = /^image\/(jpeg|png|webp|gif)$/;

/// Foto yang diunggah petugas dari HP (selfie absen, bukti bayar QRIS).
/// Disimpan di `uploads/<subdir>/<uuid>.<ext>` — folder `uploads` di-serve
/// statis oleh main.ts dan di production berupa persistent volume.
export function imageUploadOptions(subdir: string, label: string): MulterOptions {
  const dir = join(process.cwd(), 'uploads', subdir);
  mkdirSync(dir, { recursive: true });
  return {
    storage: diskStorage({
      destination: dir,
      filename: (_request, file, callback) => {
        callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
      },
    }),
    limits: { fileSize: MAKS_UKURAN },
    fileFilter: (_request, file, callback) => {
      if (!TIPE_GAMBAR.test(file.mimetype)) {
        callback(new BadRequestException(`${label} harus berupa JPG, PNG, WEBP, atau GIF.`), false);
        return;
      }
      callback(null, true);
    },
  };
}

export const imageFilePipe = () =>
  new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: MAKS_UKURAN }),
      new FileTypeValidator({ fileType: TIPE_GAMBAR, skipMagicNumbersValidation: true }),
    ],
  });

export function publicUploadUrl(request: Request, subdir: string, filename: string): string {
  const base = (process.env.PUBLIC_API_URL ?? `${request.protocol}://${request.get('host')}`).replace(/\/$/, '');
  return `${base}/uploads/${subdir}/${filename}`;
}
