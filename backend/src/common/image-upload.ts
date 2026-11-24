import { BadRequestException, FileTypeValidator, MaxFileSizeValidator, ParseFilePipe } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Request } from 'express';

const MAKS_UKURAN = 5 * 1024 * 1024;

export interface ImageTypes {
  pattern: RegExp;
  label: string;
}
const TIPE_GAMBAR: ImageTypes = { pattern: /^image\/(jpeg|png|webp|gif)$/, label: 'JPG, PNG, WEBP, atau GIF' };
/// pdfkit & ExcelJS (kop dokumen cetak di *-report.service.ts) tidak mendukung WEBP/GIF.
export const TIPE_GAMBAR_CETAK: ImageTypes = {
  pattern: /^image\/(jpeg|png)$/,
  label: 'JPG atau PNG (dipakai di dokumen cetak, WEBP/GIF tidak didukung)',
};

/// Gambar yang diunggah (selfie absen, bukti bayar, foto produk, QRIS booth, logo).
/// Disimpan di `uploads/<subdir>/<uuid>.<ext>` — folder `uploads` di-serve
/// statis oleh main.ts dan di production berupa persistent volume.
export function imageUploadOptions(subdir: string, label: string, types = TIPE_GAMBAR): MulterOptions {
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
      if (!types.pattern.test(file.mimetype)) {
        callback(new BadRequestException(`${label} harus berupa ${types.label}.`), false);
        return;
      }
      callback(null, true);
    },
  };
}

export const imageFilePipe = (types = TIPE_GAMBAR) =>
  new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: MAKS_UKURAN }),
      new FileTypeValidator({ fileType: types.pattern, skipMagicNumbersValidation: true }),
    ],
  });

export function publicUploadUrl(request: Request, subdir: string, filename: string): string {
  const base = (process.env.PUBLIC_API_URL ?? `${request.protocol}://${request.get('host')}`).replace(/\/$/, '');
  return `${base}/uploads/${subdir}/${filename}`;
}
