import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

function docNo(prefix: string): string {
  return `${prefix}-SEED-${randomUUID().slice(0, 8).toUpperCase()}`;
}

// Data referensi dari docs/obbel-coffee-ai-docs/16-seed-dummy-data.md.
// Untuk development/dev only — production harus diinput ulang oleh Admin.
async function main() {
  const categories = await Promise.all(
    [
      { code: 'COFFEE_MILK', name: 'Coffee Milk', sortOrder: 1 },
      { code: 'NON_COFFEE', name: 'Non Coffee', sortOrder: 2 },
      { code: 'COFFEE', name: 'Coffee', sortOrder: 3 },
    ].map((c) =>
      prisma.productCategory.upsert({ where: { code: c.code }, update: {}, create: c }),
    ),
  );
  const categoryByCode = Object.fromEntries(categories.map((c) => [c.code, c]));

  const products = [
    { sku: 'OBL-ORI', name: 'Original', category: 'COFFEE_MILK', price: 8000 },
    { sku: 'OBL-BSG', name: 'Brown Sugar', category: 'COFFEE_MILK', price: 10000 },
    { sku: 'OBL-SC', name: 'Salted Caramel', category: 'COFFEE_MILK', price: 10000 },
    { sku: 'OBL-ALM', name: 'Almond', category: 'COFFEE_MILK', price: 10000 },
    { sku: 'OBL-BSC', name: 'Butter Scotch', category: 'COFFEE_MILK', price: 10000 },
    { sku: 'OBL-KPD', name: 'Kopsu Pandan', category: 'COFFEE_MILK', price: 10000 },
    { sku: 'OBL-KPO', name: 'Kopsu Premium Ori', category: 'COFFEE_MILK', price: 12000 },
    { sku: 'OBL-KPR', name: 'Kopsu Premium Rasa', category: 'COFFEE_MILK', price: 13000 },
    { sku: 'OBL-MAT', name: 'Matcha', category: 'NON_COFFEE', price: 10000 },
    { sku: 'OBL-TAR', name: 'Taro', category: 'NON_COFFEE', price: 10000 },
    { sku: 'OBL-CHO', name: 'Chocolate', category: 'NON_COFFEE', price: 10000 },
    { sku: 'OBL-RV', name: 'Red Velvet', category: 'NON_COFFEE', price: 10000 },
    { sku: 'OBL-AMR', name: 'Americano', category: 'COFFEE', price: 10000 },
  ];

  const createdProducts = await Promise.all(
    products.map((p, index) =>
      prisma.product.upsert({
        where: { sku: p.sku },
        update: {},
        create: {
          sku: p.sku,
          name: p.name,
          categoryId: categoryByCode[p.category].id,
          sellPrice: BigInt(p.price),
          sortOrder: index,
        },
      }),
    ),
  );

  // 10 lokasi referensi dari 16-seed-dummy-data.md §3. Nama/alamat final
  // harus diverifikasi Admin — daftar ini bukan berarti hanya 10 Booth aktif.
  const locations = [
    'Depan Galaxy Jl. Pandanaran',
    'Depan Rumah Dinas Bupati',
    'Barat Pasar Ngebong',
    'Depan Pom Bensin Kemiri Kab. Boyolali',
    'Barat Tugu Keris Boyolali',
    'Depan SMP 3 Boyolali',
    'Depan MI Salfiyah Tukangan Ampel Boyolali',
    'Depan SMK 1 Klaten',
    'Depan Stadion/Tri Koyo Klaten',
    'Jl. Mayor Kusmanto No.82 Klaten',
  ];

  const booths = await Promise.all(
    locations.map((locationName, index) => {
      const code = `BOOTH-${String(index + 1).padStart(2, '0')}`;
      return prisma.booth.upsert({
        where: { code },
        update: {},
        create: { code, name: `Booth ${index + 1}`, locationName },
      });
    }),
  );
  const mainBooth = booths[0];

  const shiftTemplates = await Promise.all(
    [
      { id: 'a0000000-0000-4000-8000-000000000001', name: 'Shift 1', startTime: '08:00', endTime: '16:30' },
      { id: 'a0000000-0000-4000-8000-000000000003', name: 'Shift 2', startTime: '16:30', endTime: '22:00' },
    ].map((t) => prisma.shiftTemplate.upsert({ where: { id: t.id }, update: {}, create: t })),
  );
  const shiftTemplate = shiftTemplates[0];

  const passwordHash = await bcrypt.hash('obbel123', 10);

  const boothStaff = await prisma.profile.upsert({
    where: { username: 'booth01' },
    update: {},
    create: {
      username: 'booth01',
      passwordHash,
      fullName: 'Kak Rina',
      role: 'BOOTH_STAFF',
      defaultBoothId: mainBooth.id,
    },
  });

  await prisma.profile.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash, fullName: 'Admin Pusat', role: 'ADMIN' },
  });

  await prisma.profile.upsert({
    where: { username: 'owner' },
    update: {},
    create: { username: 'owner', passwordHash, fullName: 'Owner Obbel', role: 'OWNER' },
  });

  const todayStart = new Date();
  todayStart.setHours(8, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(16, 30, 0, 0);
  const businessDate = new Date(
    Date.UTC(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate()),
  );

  await prisma.shiftSession.upsert({
    where: { id: 'a0000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: 'a0000000-0000-4000-8000-000000000002',
      businessDate,
      boothId: mainBooth.id,
      shiftTemplateId: shiftTemplate.id,
      staffId: boothStaff.id,
      status: 'OPEN',
      scheduledStartAt: todayStart,
      scheduledEndAt: todayEnd,
      openedAt: todayStart,
    },
  });

  // Stok Gudang Pusat — sesuai 16-seed-dummy-data.md §7 ("100–300 cup/product").
  await Promise.all(
    createdProducts.map((product) =>
      prisma.warehouseStock.upsert({
        where: { productId: product.id },
        update: {},
        create: { productId: product.id, qtyOnHand: 300 },
      }),
    ),
  );

  // Distribusi demo berstatus SENT ke Booth 1, supaya alur "Terima Stok" di
  // app Petugas Booth ada datanya begitu backend dites end-to-end.
  const demoDistributionId = 'a0000000-0000-4000-8000-000000000004';
  const existingDemoDistribution = await prisma.stockDistribution.findUnique({
    where: { id: demoDistributionId },
  });
  if (!existingDemoDistribution) {
    const demoItems = createdProducts.slice(0, 4).map((product, index) => ({
      productId: product.id,
      qty: 20 - index * 2,
    }));

    await prisma.$transaction([
      ...demoItems.map((item) =>
        prisma.warehouseStock.update({
          where: { productId: item.productId },
          data: { qtyOnHand: { decrement: item.qty } },
        }),
      ),
      prisma.stockDistribution.create({
        data: {
          id: demoDistributionId,
          distributionNo: docNo('DIST'),
          boothId: mainBooth.id,
          status: 'SENT',
          idempotencyKey: randomUUID(),
          sentAt: new Date(),
          createdById: (await prisma.profile.findUniqueOrThrow({ where: { username: 'admin' } })).id,
          note: 'Distribusi awal (seed)',
          items: { createMany: { data: demoItems.map((i) => ({ productId: i.productId, qtySent: i.qty })) } },
        },
      }),
    ]);
  }

  // eslint-disable-next-line no-console
  console.log('Seed selesai. Dummy login (password sama untuk semua: obbel123):');
  // eslint-disable-next-line no-console
  console.log('  booth01 (BOOTH_STAFF, default booth: Booth 1) / admin (ADMIN) / owner (OWNER)');
  // eslint-disable-next-line no-console
  console.log(`  ${booths.length} booth di-seed, stok Gudang 300/produk, 1 distribusi SENT menunggu diterima Booth 1.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
