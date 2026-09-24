import { Injectable } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

/// Satu klien R2 (S3-compatible) dipakai semua modul upload (company-profile,
/// products, booths, shifts) supaya kredensial & endpoint cuma didefinisikan
/// sekali. R2 dipilih ketimbang disk lokal karena volume `uploads/` di
/// Coolify tidak persistent lintas redeploy.
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket = process.env.R2_BUCKET ?? '';
  private readonly publicUrl = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

  constructor() {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID ?? ''}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  async upload(folder: string, buffer: Buffer, contentType: string, ext: string): Promise<{ key: string; url: string }> {
    const key = `${folder}/${randomUUID()}${ext}`;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }));
    return { key, url: `${this.publicUrl}/${key}` };
  }

  /// Dipakai *-report.service.ts (lewat CompanyProfileService.getForPrint())
  /// buat menebak key R2 dari `logoUrl` yang tersimpan di DB, supaya bisa
  /// diambil ulang jadi Buffer untuk ditaruh pdfkit/ExcelJS.
  keyFromPublicUrl(url: string): string | null {
    if (!this.publicUrl || !url.startsWith(`${this.publicUrl}/`)) return null;
    return url.slice(this.publicUrl.length + 1);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as NodeJS.ReadableStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
