import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
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
  /// Path berkas LOKAL di disk (untuk `doc.image()`/`worksheet.addImage()`),
  /// bukan URL publik — laporan digenerate di proses backend yang sama
  /// dengan yang menyimpan berkasnya, jadi dibaca langsung dari disk, tanpa
  /// request HTTP bolak-balik ke diri sendiri. `null` kalau belum ada logo
  /// ATAU logoUrl menunjuk ke luar folder uploads/company milik server ini.
  logoPath: string | null;
  /// `jpeg`/`png` — dipakai `worksheet.addImage()` (ExcelJS mewajibkan
  /// ekstensi eksplisit). pdfkit tidak butuh ini, dia menebak sendiri dari isi
  /// berkas. Selalu sejalan dengan `logoPath` (`null` kalau `logoPath` null).
  logoExt: 'jpeg' | 'png' | null;
}

/// Profil Perusahaan — SATU baris singleton (`id: 'default'`), dipakai
/// sebagai kop semua dokumen cetak. Dibuat otomatis dengan nilai default
/// saat pertama kali diminta, supaya laporan tetap bisa dicetak sebelum
/// Admin sempat mengisi Pengaturan → Profil Perusahaan.
@Injectable()
export class CompanyProfileService {
  constructor(private readonly prisma: PrismaService) {}

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
    let logoPath: string | null = null;
    let logoExt: 'jpeg' | 'png' | null = null;
    if (p.logoUrl) {
      const cocok = /\/uploads\/company\/([^/?#]+)/.exec(p.logoUrl);
      if (cocok) {
        const kandidat = join(process.cwd(), 'uploads', 'company', cocok[1]);
        if (existsSync(kandidat)) {
          logoPath = kandidat;
          const ext = extname(kandidat).toLowerCase();
          logoExt = ext === '.png' ? 'png' : ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : null;
        }
      }
    }
    return { name: p.name, legalName: p.legalName, address: p.address, phone: p.phone, logoPath, logoExt };
  }
}
