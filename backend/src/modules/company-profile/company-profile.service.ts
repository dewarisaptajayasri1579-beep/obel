import { Injectable } from '@nestjs/common';
import { extname } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

const DEFAULT_ID = 'default';

/// Lokasi default sebelum Admin mengisi Profil Perusahaan sendiri — kantor
/// pusat Obbel ada di Boyolali (bukan Yogyakarta, yang sebelumnya
/// ter-hardcode di tiap *-report.service.ts sebagai contoh sewaktu fitur
/// laporan pertama kali dibuat).
const DEFAULT_ADDRESS = 'Boyolali, Jawa Tengah, Indonesia';

export interface DataCetakPerusahaan {
  name: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  /// Isi berkas logo diambil dari R2 (untuk `doc.image()`/`worksheet.addImage()`
  /// yang keduanya menerima Buffer langsung). `null` kalau belum ada logo
  /// ATAU logoUrl tidak menunjuk ke bucket R2 milik server ini ATAU gagal
  /// diambil dari storage.
  logoImage: Buffer | null;
  /// `jpeg`/`png` — dipakai `worksheet.addImage()` (ExcelJS mewajibkan
  /// ekstensi eksplisit). pdfkit tidak butuh ini, dia menebak sendiri dari isi
  /// berkas. Selalu sejalan dengan `logoImage` (`null` kalau `logoImage` null).
  logoExt: 'jpeg' | 'png' | null;
}

/// Profil Perusahaan — SATU baris singleton (`id: 'default'`), dipakai
/// sebagai kop semua dokumen cetak. Dibuat otomatis dengan nilai default
/// saat pertama kali diminta, supaya laporan tetap bisa dicetak sebelum
/// Admin sempat mengisi Pengaturan → Profil Perusahaan.
@Injectable()
export class CompanyProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async get() {
    const existing = await this.prisma.companyProfile.findUnique({ where: { id: DEFAULT_ID } });
    if (existing) return existing;
    return this.prisma.companyProfile.create({ data: { id: DEFAULT_ID, address: DEFAULT_ADDRESS } });
  }

  async update(dto: UpdateCompanyProfileDto) {
    return this.prisma.companyProfile.upsert({
      where: { id: DEFAULT_ID },
      create: {
        id: DEFAULT_ID,
        name: dto.name,
        legalName: dto.legalName,
        address: dto.address,
        phone: dto.phone,
        logoUrl: dto.logoUrl,
      },
      update: {
        name: dto.name,
        legalName: dto.legalName ?? null,
        address: dto.address ?? null,
        phone: dto.phone ?? null,
        logoUrl: dto.logoUrl ?? null,
      },
    });
  }

  /// Dipakai *-report.service.ts (PDF & Excel) — mengubah `logoUrl` (URL
  /// publik, mis. `http://host/uploads/company/xxx.webp`) jadi path disk
  /// lokal yang bisa langsung dibaca `fs`/pdfkit/exceljs.
  async getForPrint(): Promise<DataCetakPerusahaan> {
    const p = await this.get();
    let logoImage: Buffer | null = null;
    let logoExt: 'jpeg' | 'png' | null = null;
    const key = p.logoUrl ? this.storage.keyFromPublicUrl(p.logoUrl) : null;
    if (key) {
      const ext = extname(key).toLowerCase();
      const kandidatExt = ext === '.png' ? 'png' : ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : null;
      if (kandidatExt) {
        try {
          logoImage = await this.storage.getBuffer(key);
          logoExt = kandidatExt;
        } catch {
          logoImage = null;
          logoExt = null;
        }
      }
    }
    return { name: p.name, legalName: p.legalName, address: p.address, phone: p.phone, logoImage, logoExt };
  }
}
