import { ValidationPipe, INestApplication, RequestMethod } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core';
import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ACCESS_RULE_KEY } from '../src/common/access/menu-access.decorator';
import { ROLES_KEY } from '../src/modules/auth/decorators/roles.decorator';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { BoothAktifGateway } from '../src/modules/dashboard/booth-aktif.gateway';
import { PrismaService } from '../src/prisma/prisma.service';

/// BR-044 — RBAC per menu: Owner membuat peran & memasangnya ke Admin; hak akses dibaca dari DB
/// tiap request (berlaku langsung); endpoint Admin/Owner tanpa aturan akses ditolak (fail-closed).
/// Pemeriksaan "lolos guard" memakai body kosong → 400 dari ValidationPipe (jalan SETELAH guard),
/// supaya tidak ada efek stok; "ditolak guard" → 403.
describe('RBAC per menu (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let ownerToken: string;
  let staffToken: string;
  let ujiToken: string;
  let ujiId: string;
  const UJI = 'e2e_rbac_admin';
  const PREFIX = 'E2E RBAC';

  const server = () => app.getHttpServer();
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = async (username: string) =>
    (await request(server()).post('/auth/login').send({ username, password: 'obbel123' }).expect(200)).body;

  async function bersihkanPeran() {
    await prisma.profile.updateMany({ where: { username: UJI }, data: { accessRoleId: null } });
    await prisma.accessRole.deleteMany({ where: { name: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule, DiscoveryModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    [adminToken, ownerToken, staffToken] = (await Promise.all([login('admin'), login('owner'), login('booth01')])).map(
      (b) => b.accessToken as string,
    );

    await bersihkanPeran();
    const ada = await prisma.profile.findUnique({ where: { username: UJI } });
    if (ada) {
      await prisma.profile.update({ where: { id: ada.id }, data: { active: true } });
      await request(server()).post(`/users/${ada.id}/reset-password`).set(bearer(ownerToken)).send({ newPassword: 'obbel123' }).expect(201);
      ujiId = ada.id;
    } else {
      ujiId = (
        await request(server())
          .post('/users')
          .set(bearer(adminToken))
          .send({ username: UJI, password: 'obbel123', fullName: 'E2E Admin Gudang', role: 'ADMIN' })
          .expect(201)
      ).body.id;
    }
    ujiToken = (await login(UJI)).accessToken;
  });

  afterAll(async () => {
    await bersihkanPeran();
    await prisma.profile.updateMany({ where: { username: UJI }, data: { active: false } });
    await app.close();
  });

  const peranBody = (name: string, permissions: { menu: string; level: 'VIEW' | 'MANAGE' }[]) => ({ name, permissions });

  it('tags every Admin/Owner endpoint with an access rule and guards every controller', () => {
    const discovery = app.get(DiscoveryService);
    const reflector = app.get(Reflector);
    const belum: string[] = [];
    for (const wrapper of discovery.getControllers()) {
      const ctrl = wrapper.metatype as (new (...a: unknown[]) => unknown) | undefined;
      if (!ctrl || ctrl.name === 'AuthController') continue;
      const guards = (Reflect.getMetadata(GUARDS_METADATA, ctrl) ?? []) as unknown[];
      if (!guards.includes(RolesGuard)) belum.push(`${ctrl.name}: tanpa RolesGuard`);
      const proto = ctrl.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (name === 'constructor' || typeof handler !== 'function' || Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
        const roles = reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [handler, ctrl]);
        const rule = reflector.getAllAndOverride(ACCESS_RULE_KEY, [handler, ctrl]);
        const bolehAdminOwner = !roles || roles.length === 0 || roles.includes(UserRole.ADMIN) || roles.includes(UserRole.OWNER);
        if (bolehAdminOwner && !rule) {
          belum.push(`${ctrl.name}.${name} (${RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)]})`);
        }
      }
    }
    expect(belum).toEqual([]);
    expect(discovery.getControllers().length).toBeGreaterThan(20);
  });

  it('gives an Admin without a role only lookups and their own profile', async () => {
    const me = await request(server()).get('/users/me').set(bearer(ujiToken)).expect(200);
    expect(me.body.access).toEqual({ roleName: null, levels: {} });
    const ditolak = await request(server()).get('/sales').set(bearer(ujiToken)).expect(403);
    expect(ditolak.body.code).toBe('MENU_ACCESS_DENIED');
    expect(ditolak.body.message).toContain('Kasir');
    await request(server()).get('/booths').set(bearer(ujiToken)).expect(200);
    await request(server()).get('/products').set(bearer(ujiToken)).expect(200);
  });

  it('lets only Owner manage roles and assign them; the system role is locked', async () => {
    await request(server()).post('/access-roles').set(bearer(adminToken)).send(peranBody(`${PREFIX} X`, [])).expect(403);
    await request(server()).patch(`/users/${ujiId}/access-role`).set(bearer(adminToken)).send({ accessRoleId: null }).expect(403);

    const sistem = (await request(server()).get('/access-roles').set(bearer(ownerToken)).expect(200)).body.find(
      (r: { fullAccess: boolean }) => r.fullAccess,
    );
    expect(sistem.name).toBe('Akses Penuh');
    expect((await request(server()).patch(`/access-roles/${sistem.id}`).set(bearer(ownerToken)).send(peranBody('Ganti', [])).expect(400)).body.code).toBe(
      'ACCESS_ROLE_SYSTEM',
    );
    expect((await request(server()).delete(`/access-roles/${sistem.id}`).set(bearer(ownerToken)).expect(400)).body.code).toBe('ACCESS_ROLE_SYSTEM');
    await request(server()).post('/access-roles').set(bearer(ownerToken)).send(peranBody(`${PREFIX} Menu Asing`, [{ menu: 'BUKAN_MENU', level: 'VIEW' }])).expect(400);
  });

  it('enforces View/Manage per menu for an Admin with a custom role, and changes apply on the next request', async () => {
    const peran = (
      await request(server())
        .post('/access-roles')
        .set(bearer(ownerToken))
        .send(peranBody(`${PREFIX} Gudang`, [
          { menu: 'KASIR', level: 'VIEW' },
          { menu: 'PEMUSNAHAN_STOK', level: 'MANAGE' },
        ]))
        .expect(201)
    ).body;
    expect((await request(server()).post('/access-roles').set(bearer(ownerToken)).send(peranBody(`${PREFIX.toLowerCase()} gudang`, [])).expect(400)).body.code).toBe(
      'ACCESS_ROLE_NAME_TAKEN',
    );
    await request(server()).patch(`/users/${ujiId}/access-role`).set(bearer(ownerToken)).send({ accessRoleId: peran.id }).expect(200);

    // Token lama tetap dipakai: hak akses dibaca dari DB.
    await request(server()).get('/sales').set(bearer(ujiToken)).expect(200);
    expect((await request(server()).post(`/sales/${randomUUID()}/void`).set(bearer(ujiToken)).send({}).expect(403)).body.code).toBe('MENU_ACCESS_DENIED');
    await request(server()).get('/stock-adjustments').set(bearer(ujiToken)).expect(200);
    await request(server()).post('/stock-adjustments/write-off').set(bearer(ujiToken)).send({}).expect(400);
    await request(server()).get('/stock-receipts').set(bearer(ujiToken)).expect(403);
    await request(server()).patch('/app-settings').set(bearer(ujiToken)).send({ attendanceRadiusMeters: 100 }).expect(403);
    const me = (await request(server()).get('/users/me').set(bearer(ujiToken)).expect(200)).body;
    expect(me.access).toEqual({ roleName: `${PREFIX} Gudang`, levels: { KASIR: 'VIEW', PEMUSNAHAN_STOK: 'MANAGE' } });

    await request(server())
      .patch(`/access-roles/${peran.id}`)
      .set(bearer(ownerToken))
      .send(peranBody(`${PREFIX} Gudang`, [{ menu: 'PEMUSNAHAN_STOK', level: 'VIEW' }]))
      .expect(200);
    await request(server()).get('/sales').set(bearer(ujiToken)).expect(403);
    await request(server()).post('/stock-adjustments/write-off').set(bearer(ujiToken)).send({}).expect(403);

    // Peran dipakai tidak bisa dihapus; setelah dicabut bisa.
    expect((await request(server()).delete(`/access-roles/${peran.id}`).set(bearer(ownerToken)).expect(400)).body.code).toBe('ACCESS_ROLE_IN_USE');
    await request(server()).patch(`/users/${ujiId}/access-role`).set(bearer(ownerToken)).send({ accessRoleId: null }).expect(200);
    await request(server()).delete(`/access-roles/${peran.id}`).set(bearer(ownerToken)).expect(200);
  });

  it('limits account management by target role', async () => {
    const akun = (role: string) => ({ username: `e2e_rbac_${randomUUID().slice(0, 8)}`, password: 'obbel123', fullName: 'E2E', role });
    await request(server()).post('/users').set(bearer(adminToken)).send(akun('OWNER')).expect(403);
    // Admin tanpa peran: tidak boleh membuat Admin maupun Barista.
    await request(server()).post('/users').set(bearer(ujiToken)).send(akun('ADMIN')).expect(403);
    await request(server()).post('/users').set(bearer(ujiToken)).send(akun('BOOTH_STAFF')).expect(403);
    // Owner: boleh reset password Admin, tidak boleh mengelola Barista (read-only operasional).
    await request(server()).post(`/users/${ujiId}/reset-password`).set(bearer(ownerToken)).send({ newPassword: 'obbel123' }).expect(201);
    const barista = await prisma.profile.findUniqueOrThrow({ where: { username: 'booth01' } });
    await request(server()).post(`/users/${barista.id}/reset-password`).set(bearer(ownerToken)).send({ newPassword: 'obbel123' }).expect(403);
    // Peran hanya untuk Admin.
    expect((await request(server()).patch(`/users/${barista.id}/access-role`).set(bearer(ownerToken)).send({ accessRoleId: null }).expect(400)).body.code).toBe(
      'ACCESS_ROLE_ADMIN_ONLY',
    );
  });

  it('lets only Owner attach an access role while creating an Admin account', async () => {
    const username = `e2e_rbac_${randomUUID().slice(0, 8)}`;
    const akun = (extra: object, role = 'ADMIN') => ({ username, password: 'obbel123', fullName: 'E2E Dibuat Owner', role, ...extra });
    const peran = (await request(server()).post('/access-roles').set(bearer(ownerToken)).send(peranBody(`${PREFIX} Saat Buat`, [{ menu: 'KASIR', level: 'VIEW' }])).expect(201)).body;
    try {
      // Admin (bahkan Akses Penuh) tidak boleh memasang peran, dan akunnya tidak boleh terbentuk.
      await request(server()).post('/users').set(bearer(adminToken)).send(akun({ accessRoleId: peran.id })).expect(403);
      expect(await prisma.profile.findUnique({ where: { username } })).toBeNull();
      // Peran hanya untuk akun Admin; peran yang tidak ada ditolak dan tidak membuat akun.
      expect((await request(server()).post('/users').set(bearer(ownerToken)).send(akun({ accessRoleId: peran.id }, 'OWNER')).expect(400)).body.code).toBe('ACCESS_ROLE_ADMIN_ONLY');
      await request(server()).post('/users').set(bearer(ownerToken)).send(akun({ accessRoleId: randomUUID() })).expect(404);
      expect(await prisma.profile.findUnique({ where: { username } })).toBeNull();
      // Owner: akun terbentuk dengan peran terpasang dan langsung berlaku.
      const dibuat = (await request(server()).post('/users').set(bearer(ownerToken)).send(akun({ accessRoleId: peran.id })).expect(201)).body;
      expect(dibuat.accessRole).toEqual({ id: peran.id, name: peran.name });
      const token = (await login(username)).accessToken as string;
      await request(server()).get('/sales').set(bearer(token)).expect(200);
      await request(server()).get('/stock-receipts').set(bearer(token)).expect(403);
    } finally {
      await prisma.profile.deleteMany({ where: { username } });
      await prisma.accessRole.deleteMany({ where: { id: peran.id } });
    }
  });

  it('refuses to deactivate your own account', async () => {
    for (const [username, token] of [['owner', ownerToken], ['admin', adminToken]] as const) {
      const saya = await prisma.profile.findUniqueOrThrow({ where: { username } });
      try {
        const res = await request(server()).patch(`/users/${saya.id}`).set(bearer(token)).send({ active: false }).expect(400);
        expect(res.body.code).toBe('CANNOT_DEACTIVATE_SELF');
        expect((await prisma.profile.findUniqueOrThrow({ where: { username } })).active).toBe(true);
        // Mengubah hal lain di akun sendiri tetap boleh (tidak ikut terblokir).
        await request(server()).patch(`/users/${saya.id}`).set(bearer(token)).send({ active: true }).expect(200);
      } finally {
        // Akun seed dipakai semua suite: kalau guard gagal, jangan tinggalkan nonaktif.
        await prisma.profile.update({ where: { id: saya.id }, data: { active: true } });
      }
    }
  });

  it('keeps Owner read-only: View everywhere, no Manage', async () => {
    await request(server()).get('/stock-adjustments').set(bearer(ownerToken)).expect(200);
    await request(server()).get('/stock-receipts').set(bearer(ownerToken)).expect(200);
    expect((await request(server()).post('/stock-adjustments/write-off').set(bearer(ownerToken)).send({}).expect(403)).body.code).toBe('MENU_ACCESS_DENIED');
    await request(server()).post(`/shifts/${randomUUID()}/cash-deposit/confirm`).set(bearer(ownerToken)).send({}).expect(403);
  });

  it('leaves Barista outside RBAC', async () => {
    await request(server()).get('/catalog').set(bearer(staffToken)).expect(200);
    await request(server()).get('/sales').set(bearer(staffToken)).expect(200);
    await request(server()).get('/catalog').set(bearer(adminToken)).expect(403);
  });

  it('rejects a deactivated account immediately, even with a valid token', async () => {
    await request(server()).patch(`/users/${ujiId}`).set(bearer(ownerToken)).send({ active: false }).expect(200);
    await request(server()).get('/users/me').set(bearer(ujiToken)).expect(401);
    await request(server()).patch(`/users/${ujiId}`).set(bearer(ownerToken)).send({ active: true }).expect(200);
    await request(server()).get('/users/me').set(bearer(ujiToken)).expect(200);
  });

  it('closes the Booth Aktif socket for an Admin without View on that menu', async () => {
    const gateway = app.get(BoothAktifGateway);
    const klien = (token: string) => ({ handshake: { auth: { token } }, disconnect: jest.fn(), emit: jest.fn() });
    const tanpaAkses = klien(ujiToken);
    await gateway.handleConnection(tanpaAkses as never);
    expect(tanpaAkses.disconnect).toHaveBeenCalled();
    const admin = klien(adminToken);
    await gateway.handleConnection(admin as never);
    expect(admin.disconnect).not.toHaveBeenCalled();
  });
});
