import { ShiftStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomainError } from './domain-error';

/// Stok Kembali & Setor Uang shift yang sudah Check-Out baru boleh di-approve Admin
/// setelah Barista absen Kembali di Gudang (BR-042) — barang & uangnya baru benar-benar
/// sampai saat itu. Retur yang diajukan di tengah shift (shift masih OPEN) tidak
/// terkena. Dipakai ShiftsService.confirmCashDeposit & ReturnsService.receive.
export async function pastikanBaristaSudahKembali(prisma: PrismaService, shiftSessionId: string) {
  const shift = await prisma.shiftSession.findUnique({
    where: { id: shiftSessionId },
    select: { status: true, returnedAt: true, staff: { select: { fullName: true } } },
  });
  if (shift?.status === ShiftStatus.CLOSED && !shift.returnedAt) {
    throw new DomainError(
      'BARISTA_NOT_RETURNED',
      `${shift.staff.fullName} belum absen Kembali di Gudang. Approve setelah Barista kembali.`,
    );
  }
}
