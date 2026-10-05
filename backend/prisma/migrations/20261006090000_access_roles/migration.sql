-- BR-044 — Peran & hak akses Admin per menu (RBAC).

-- CreateEnum
CREATE TYPE "access_level" AS ENUM ('VIEW', 'MANAGE');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "access_role_id" TEXT;

-- CreateTable
CREATE TABLE "access_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "full_access" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_role_permissions" (
    "id" TEXT NOT NULL,
    "access_role_id" TEXT NOT NULL,
    "menu" TEXT NOT NULL,
    "level" "access_level" NOT NULL,

    CONSTRAINT "access_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_roles_name_key" ON "access_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "access_role_permissions_access_role_id_menu_key" ON "access_role_permissions"("access_role_id", "menu");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_access_role_id_fkey" FOREIGN KEY ("access_role_id") REFERENCES "access_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_role_permissions" ADD CONSTRAINT "access_role_permissions_access_role_id_fkey" FOREIGN KEY ("access_role_id") REFERENCES "access_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: peran sistem akses penuh, dipasang ke semua Admin yang sudah ada supaya tidak ada yang terkunci saat deploy.
INSERT INTO "access_roles" ("id", "name", "description", "full_access", "updated_at")
VALUES (gen_random_uuid()::text, 'Admin Pusat', 'Peran sistem: Kelola di semua menu. Tidak bisa diubah atau dihapus.', true, CURRENT_TIMESTAMP);

UPDATE "profiles"
SET "access_role_id" = (SELECT "id" FROM "access_roles" WHERE "full_access" = true)
WHERE "role" = 'ADMIN';
