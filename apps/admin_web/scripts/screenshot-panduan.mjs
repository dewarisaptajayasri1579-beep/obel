// Screenshot untuk Panduan Pengguna (/panduan). Membuka admin web yang sedang jalan dengan
// Chrome terpasang, login lewat form asli, lalu menyimpan tiap gambar ke public/panduan/*.webp.
//
// Read-only: semua request API selain GET diblokir (kecuali login dan closing/start, lihat
// BOLEH_TULIS), dan resep hanya membuka halaman, tab, keranjang, atau sheet. Lokasi & kamera ditolak.
// Layar yang bergantung pada tahap shift (Absen Berangkat/Tiba/Kembali) memalsukan respons GET
// status shift saja; tampilan dan data lainnya tetap asli.
//
//   npm run panduan:screenshot              semua gambar
//   npm run panduan:screenshot -- barista   hanya file yang namanya diawali "barista"
//
// Env: PANDUAN_ADMIN_USER, PANDUAN_ADMIN_PASS, PANDUAN_BARISTA_USER, PANDUAN_BARISTA_PASS,
// PANDUAN_BASE_URL (default http://localhost:3000). Akun Barista harus punya shift OPEN yang
// sudah Absen Tiba dan jam shift-nya sudah lewat (layar Check-Out).
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
// shortcut: sharp ikut terpasang sebagai optionalDependency Next.js; tambahkan ke devDependencies bila Next berhenti membawanya.
import sharp from "sharp";

const BASE = (process.env.PANDUAN_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = fileURLToPath(new URL("../public/panduan/", import.meta.url));
const filter = process.argv[2] ?? "";

/// Request tulis yang tetap diizinkan: login, transport socket.io (long-polling, bukan data), dan
/// closing/start yang dipanggil layar Check-Out saat dibuka (hanya membuat snapshot DRAFT; shift
/// tetap OPEN).
const BOLEH_TULIS = [/\/auth\/login$/, /^\/socket\.io\//, /\/shifts\/[^/]+\/closing\/start$/];

/// Indikator dev Next.js tidak boleh ikut terpotret.
const SEMBUNYIKAN = "nextjs-portal{display:none!important}";

const tambahKeKeranjang = (page) => page.locator("button:has(svg.lucide-plus):not([disabled])").first().click();
const bukaKeranjang = async (page) => {
  await tambahKeKeranjang(page);
  await page.getByRole("button", { name: "Lihat Keranjang" }).click();
};
const gulirKeBawah = (page) => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
/// Folder public/ bisa diunduh tanpa login: username (separuh kredensial) diburamkan.
const samarkanUsername = (page) => page.addStyleTag({ content: "tbody td:first-child{filter:blur(5px)}" });

/// Mock GET status shift. Fungsi menerima respons asli /shifts/active (shift panduan harus OPEN).
const tanpaShift = { "/shifts/active": () => ({ status: 404, body: { code: "NOT_FOUND", message: "Tidak ada shift aktif." } }), "/shifts/pending-return": () => ({ body: null }) };
const belumTiba = { "/shifts/active": (asli) => ({ body: { ...asli, arrivedAt: null } }) };
const sudahCheckOut = {
  "/shifts/active": () => ({ status: 404, body: { code: "NOT_FOUND", message: "Tidak ada shift aktif." } }),
  "/shifts/pending-return": (aktif) => ({
    body: { shiftSessionId: aktif.shiftSessionId, booth: aktif.booth, shiftName: aktif.shiftName, closedAt: new Date().toISOString(), cashFloat: aktif.cashFloat, expectedCash: aktif.cashFloat },
  }),
};

/// Resep per file. `siapkan` hanya membuka tampilan, tidak pernah mengirim data.
const RESEP = [
  { file: "barista-login-1.webp", peran: "tamu", path: "/petugas/login" },
  { file: "barista-beranda-1.webp", peran: "barista", path: "/petugas" },
  { file: "barista-beranda-2.webp", peran: "barista", path: "/petugas", siapkan: (p) => p.getByRole("button", { name: "Riwayat", exact: true }).click() },
  { file: "barista-berangkat-1.webp", peran: "barista", path: "/petugas/check-in", mock: tanpaShift },
  { file: "barista-berangkat-2.webp", peran: "barista", path: "/petugas/check-in", mock: tanpaShift, siapkan: gulirKeBawah },
  { file: "barista-tiba-1.webp", peran: "barista", path: "/petugas/tiba", mock: belumTiba },
  { file: "barista-terima-stok-1.webp", peran: "barista", path: "/petugas/terima-stok" },
  { file: "barista-terima-stok-2.webp", peran: "barista", path: "/petugas/terima-stok", siapkan: (p) => p.getByText("Dari Gudang Pusat").first().click() },
  { file: "barista-kasir-1.webp", peran: "barista", path: "/petugas/kasir" },
  { file: "barista-kasir-2.webp", peran: "barista", path: "/petugas/kasir", siapkan: bukaKeranjang },
  {
    file: "barista-kasir-3.webp",
    peran: "barista",
    path: "/petugas/kasir",
    siapkan: async (page) => {
      await bukaKeranjang(page);
      await page.getByRole("button", { name: "Lanjut Pembayaran" }).click();
    },
  },
  { file: "barista-stok-1.webp", peran: "barista", path: "/petugas/stok" },
  { file: "barista-stok-2.webp", peran: "barista", path: "/petugas/stok?tab=RESTOCK" },
  { file: "barista-notifikasi-1.webp", peran: "barista", path: "/petugas/notifikasi" },
  { file: "barista-riwayat-penjualan-1.webp", peran: "barista", path: "/petugas/riwayat-penjualan" },
  { file: "barista-riwayat-stok-1.webp", peran: "barista", path: "/petugas/riwayat-stok" },
  { file: "barista-riwayat-absen-1.webp", peran: "barista", path: "/petugas/riwayat-absen" },
  { file: "barista-checkout-1.webp", peran: "barista", path: "/petugas/checkout" },
  { file: "barista-checkout-2.webp", peran: "barista", path: "/petugas/checkout", siapkan: (p) => p.getByRole("button", { name: "LANJUT CHECK OUT" }).click() },
  { file: "barista-kembali-1.webp", peran: "barista", path: "/petugas/kembali", mock: sudahCheckOut },
  { file: "barista-setting-1.webp", peran: "barista", path: "/petugas/setting" },

  { file: "admin-booth-aktif-1.webp", peran: "admin", path: "/monitoring/booth-aktif" },
  { file: "admin-booth-aktif-2.webp", peran: "admin", path: "/monitoring/booth-aktif", siapkan: (p) => p.getByText("BOOTH-02", { exact: true }).first().click() },
  { file: "admin-booth-aktif-3.webp", peran: "admin", path: "/monitoring/booth-aktif", siapkan: async (p) => { await p.getByRole("button", { name: "Peta Lokasi" }).click(); await p.waitForTimeout(2000); } },
  { file: "admin-dashboard-1.webp", peran: "admin", path: "/dashboard" },
  { file: "admin-dashboard-2.webp", peran: "admin", path: "/dashboard?tab=laporan" },
  { file: "admin-penerimaan-1.webp", peran: "admin", path: "/stok/penerimaan" },
  { file: "admin-penerimaan-2.webp", peran: "admin", path: "/stok/penerimaan/baru" },
  { file: "admin-pemusnahan-1.webp", peran: "admin", path: "/stok/pemusnahan" },
  { file: "admin-pemusnahan-2.webp", peran: "admin", path: "/stok/pemusnahan", siapkan: (p) => p.getByRole("button", { name: "Musnahkan Stok" }).click() },
  { file: "admin-serah-terima-stok-1.webp", peran: "admin", path: "/serah-terima-stok" },
  { file: "admin-serah-terima-stok-2.webp", peran: "admin", path: "/serah-terima-stok/baru" },
  { file: "admin-transaksi-checkin-checkout-1.webp", peran: "admin", path: "/transaksi-checkin-checkout" },
  { file: "admin-transaksi-checkin-checkout-2.webp", peran: "admin", path: "/transaksi-checkin-checkout", siapkan: (p) => p.getByRole("button", { name: "Beri Izin Absen" }).click() },
  { file: "admin-transaksi-terima-stok-1.webp", peran: "admin", path: "/transaksi-terima-stok" },
  { file: "admin-transaksi-kasir-1.webp", peran: "admin", path: "/transaksi-kasir" },
  { file: "admin-transaksi-kasir-2.webp", peran: "admin", path: "/transaksi-kasir", siapkan: (p) => p.getByRole("button", { name: "Sebaran Penjualan" }).click() },
  { file: "admin-transaksi-laporan-kembali-1.webp", peran: "admin", path: "/transaksi-laporan-kembali" },
  { file: "admin-stok-selisih-1.webp", peran: "admin", path: "/laporan/stok-selisih" },
  { file: "admin-pengembalian-stok-1.webp", peran: "admin", path: "/laporan/pengembalian-stok" },
  { file: "admin-produk-1.webp", peran: "admin", path: "/master/produk" },
  { file: "admin-produk-2.webp", peran: "admin", path: "/master/produk/baru" },
  { file: "admin-produk-3.webp", peran: "admin", path: "/master/produk?tab=pengaturan" },
  { file: "admin-booth-1.webp", peran: "admin", path: "/master/booth" },
  { file: "admin-booth-2.webp", peran: "admin", path: "/master/booth?tab=setting-petugas" },
  { file: "admin-petugas-1.webp", peran: "admin", path: "/master/petugas", siapkan: samarkanUsername },
  { file: "admin-petugas-2.webp", peran: "admin", path: "/master/petugas/baru" },
  { file: "admin-tampilan-1.webp", peran: "admin", path: "/pengaturan/tampilan" },
  { file: "admin-profil-perusahaan-1.webp", peran: "admin", path: "/pengaturan/profil-perusahaan" },
  { file: "admin-absensi-1.webp", peran: "admin", path: "/pengaturan/absensi" },
  { file: "admin-shift-1.webp", peran: "admin", path: "/master/shift" },
  { file: "admin-user-1.webp", peran: "admin", path: "/master/user", siapkan: samarkanUsername },
  // Peran & Hak Akses hanya untuk Owner: sesi Admin akses penuh ditampilkan sebagai Owner di browser
  // (role di sesi localStorage), datanya tetap dibaca lewat GET /access-roles yang memang boleh untuk Admin.
  { file: "admin-peran-1.webp", peran: "owner", path: "/master/peran" },
  { file: "admin-peran-2.webp", peran: "owner", path: "/master/peran", siapkan: (p) => p.getByRole("button", { name: "Tambah Peran" }).click() },
];

const AKUN = {
  admin: { user: "PANDUAN_ADMIN_USER", pass: "PANDUAN_ADMIN_PASS", login: "/login", userField: "Username", passField: "Password" },
  barista: { user: "PANDUAN_BARISTA_USER", pass: "PANDUAN_BARISTA_PASS", login: "/petugas/login", userField: "Masukkan username", passField: "Masukkan password" },
};
const VIEWPORT = {
  admin: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  barista: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
VIEWPORT.tamu = VIEWPORT.barista;
VIEWPORT.owner = VIEWPORT.admin;
AKUN.owner = AKUN.admin;

const diblokir = [];

async function bukaContext(browser, peran) {
  const context = await browser.newContext({ ...VIEWPORT[peran], permissions: [] });
  // Dev server meng-compile halaman saat pertama dibuka; di laptop ini bisa lebih dari 30 detik.
  context.setDefaultTimeout(120_000);
  await context.addInitScript((css) => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = css;
      document.head.appendChild(s);
    });
  }, SEMBUNYIKAN);
  await context.route("**/*", (route) => {
    const req = route.request();
    const api = ["fetch", "xhr"].includes(req.resourceType());
    if (api && req.method() !== "GET" && !BOLEH_TULIS.some((r) => r.test(new URL(req.url()).pathname))) {
      diblokir.push(`${req.method()} ${new URL(req.url()).pathname}`);
      return route.abort();
    }
    return route.fallback();
  });
  const page = await context.newPage();
  if (peran === "tamu") return page;

  const a = AKUN[peran];
  const user = process.env[a.user];
  const pass = process.env[a.pass];
  if (!user || !pass) throw new Error(`Env ${!user ? a.user : a.pass} belum diisi.`);
  await page.goto(BASE + a.login);
  // Login Admin punya dua form (layout desktop & mobile); isi yang terlihat.
  await page.locator(`input[placeholder="${a.userField}"]:visible`).fill(user);
  await page.locator(`input[placeholder="${a.passField}"]:visible`).fill(pass);
  await page.locator('button[type="submit"]:visible').click();
  try {
    await page.waitForURL((url) => !url.pathname.endsWith(a.login), { timeout: 30_000 });
  } catch {
    const pesan = (await page.locator('[role="alert"]').first().textContent().catch(() => null)) ?? "tidak ada pesan";
    throw new Error(`Login ${peran} gagal: ${pesan.trim()}`);
  }
  if (peran === "owner") {
    // Hanya tampilan browser: role di sesi localStorage diganti OWNER; backend tetap melihat Admin.
    await page.evaluate(() => {
      const kunci = "obbel-admin-session";
      const sesi = JSON.parse(localStorage.getItem(kunci));
      localStorage.setItem(kunci, JSON.stringify({ ...sesi, profile: { ...sesi.profile, role: "OWNER" } }));
    });
  }
  return page;
}

/// Pasang mock GET status shift untuk satu resep; mengembalikan fungsi pelepasnya.
async function pasangMock(page, mock) {
  const handler = async (route) => {
    const path = new URL(route.request().url()).pathname;
    const buat = route.request().method() === "GET" && mock[path];
    if (!buat) return route.fallback();
    const asliRes = await route.fetch({ url: route.request().url().replace(/\/shifts\/[^/]+$/, "/shifts/active") });
    const aktif = asliRes.ok() ? await asliRes.json() : null;
    if (!aktif) throw new Error("Shift panduan tidak OPEN; mock status shift butuh shift aktif.");
    const { status = 200, body } = buat(aktif);
    return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  };
  await page.route("**/shifts/**", handler);
  return () => page.unroute("**/shifts/**", handler);
}

/// Data halaman dimuat setelah networkidle (socket & fetch berantai), jadi tunggu spinner hilang.
const tungguSiap = (page) =>
  page.waitForFunction(() => !document.querySelector(".animate-spin"), null, { timeout: 120_000 });

const resep = RESEP.filter((r) => r.file.startsWith(filter));
if (resep.length === 0) throw new Error(`Tidak ada resep yang cocok dengan "${filter}".`);
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const halaman = {};
  for (const r of resep) {
    halaman[r.peran] ??= await bukaContext(browser, r.peran);
    const page = halaman[r.peran];
    const lepas = r.mock ? await pasangMock(page, r.mock) : null;
    try {
      await page.goto(BASE + r.path);
      await page.waitForLoadState("networkidle");
      await tungguSiap(page);
      if (r.siapkan) await r.siapkan(page);
      await page.waitForTimeout(500); // animasi sheet/fade selesai
      const png = await page.screenshot();
      await writeFile(OUT + r.file, await sharp(png).webp({ quality: 80 }).toBuffer());
      console.log("ok", r.file);
    } finally {
      await lepas?.();
    }
  }
} finally {
  await browser.close();
}
// Request tulis yang diblokir berarti sebuah halaman mencoba mengubah data; gambarnya bisa menampilkan
// keadaan gagal, jadi hentikan dengan keras.
if (diblokir.length) {
  console.error("Request tulis yang diblokir:", [...new Set(diblokir)].join(", "));
  process.exit(1);
}
