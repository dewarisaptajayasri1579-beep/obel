import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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

  const booth = await prisma.booth.upsert({
    where: { code: 'BOOTH-01' },
    update: {},
    create: { code: 'BOOTH-01', name: 'Booth Gallery Pandanaran', locationName: 'Jl. Pandanaran' },
  });

  const shiftTemplate = await prisma.shiftTemplate.upsert({
    where: { id: 'a0000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'a0000000-0000-4000-8000-000000000001',
      name: 'Shift 1',
      startTime: '08:00',
      endTime: '16:30',
    },
  });

  const passwordHash = await bcrypt.hash('obbel123', 10);

  const boothStaff = await prisma.profile.upsert({
    where: { username: 'booth01' },
    update: {},
    create: {
      username: 'booth01',
      passwordHash,
      fullName: 'Kak Rina',
      role: 'BOOTH_STAFF',
      defaultBoothId: booth.id,
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
      boothId: booth.id,
      shiftTemplateId: shiftTemplate.id,
      staffId: boothStaff.id,
      status: 'OPEN',
      scheduledStartAt: todayStart,
      scheduledEndAt: todayEnd,
      openedAt: todayStart,
    },
  });

  await Promise.all(
    createdProducts.map((product, index) =>
      prisma.boothStock.upsert({
        where: { boothId_productId: { boothId: booth.id, productId: product.id } },
        update: {},
        create: { boothId: booth.id, productId: product.id, qtyOnHand: 100 - index * 5 },
      }),
    ),
  );

  // eslint-disable-next-line no-console
  console.log('Seed selesai. Dummy login (password sama untuk semua: obbel123):');
  // eslint-disable-next-line no-console
  console.log('  booth01 (BOOTH_STAFF) / admin (ADMIN) / owner (OWNER)');
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
