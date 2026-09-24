/// Tindak lanjut Admin per baris produk yang selisih — dipakai di dua
/// tempat: Koreksi Penerimaan Kirim Stok (distributions.service.ts
/// correctReceipt()) dan approve Stok Kembali (returns.service.ts receive()).
/// Sama makna di kedua tempat:
/// - RUSAK: qty tetap dikurangi dari stok, ditandai utk Laporan Stok Selisih.
/// - SALAH_HITUNG: qty dikoreksi ke angka yang benar, tidak dianggap kerugian
///   (sengaja tidak meninggalkan jejak reason code — qty yang sudah benar
///   itu sendiri representasinya).
/// - GANTI_RUGI_PETUGAS: dicatat sebagai StaffLiability dibebankan ke
///   Petugas terkait, belum ada alur pelunasan.
/// - LAINNYA: tidak ada aksi stok/liability otomatis, cuma catatan bebas
///   (wajib diisi) buat kasus di luar 3 di atas.
export type TindakLanjutSelisih = 'RUSAK' | 'SALAH_HITUNG' | 'GANTI_RUGI_PETUGAS' | 'LAINNYA';

export const TINDAK_LANJUT_VALUES: TindakLanjutSelisih[] = ['RUSAK', 'SALAH_HITUNG', 'GANTI_RUGI_PETUGAS', 'LAINNYA'];
