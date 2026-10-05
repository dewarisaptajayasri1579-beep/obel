-- Absensi 4 titik (BR-042) + uang jalan (BR-043).
-- CreateEnum
CREATE TYPE "attendance_permit_type" AS ENUM ('LOCATION', 'EARLY_CHECKOUT');

-- CreateEnum
CREATE TYPE "attendance_point" AS ENUM ('DEPART', 'ARRIVE', 'FINISH', 'RETURN');

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "attendance_radius_meters" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "early_checkout_tolerance_minutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "warehouse_latitude" DECIMAL(9,6),
ADD COLUMN     "warehouse_longitude" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "booths" ADD COLUMN     "cash_float" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "shift_sessions" ADD COLUMN     "arrival_latitude" DECIMAL(9,6),
ADD COLUMN     "arrival_longitude" DECIMAL(9,6),
ADD COLUMN     "arrival_photo_url" TEXT,
ADD COLUMN     "arrived_at" TIMESTAMP(3),
ADD COLUMN     "cash_float" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "return_latitude" DECIMAL(9,6),
ADD COLUMN     "return_longitude" DECIMAL(9,6),
ADD COLUMN     "return_photo_url" TEXT,
ADD COLUMN     "returned_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "attendance_permits" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "type" "attendance_permit_type" NOT NULL,
    "point" "attendance_point",
    "reason" TEXT NOT NULL,
    "granted_by" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "business_date" DATE NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_shift_session_id" TEXT,

    CONSTRAINT "attendance_permits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_permits_staff_id_business_date_idx" ON "attendance_permits"("staff_id", "business_date");

-- AddForeignKey
ALTER TABLE "attendance_permits" ADD CONSTRAINT "attendance_permits_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_permits" ADD CONSTRAINT "attendance_permits_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: shift lama tidak boleh terkunci oleh aturan baru. Yang sudah CLOSED
-- dianggap sudah Kembali (Laporan Kembali-nya tetap bisa di-approve), yang masih
-- OPEN saat deploy dianggap sudah Tiba (bisa Check-Out tanpa absen Tiba).
UPDATE "shift_sessions" SET "returned_at" = "closed_at" WHERE "status" = 'CLOSED' AND "returned_at" IS NULL;
UPDATE "shift_sessions" SET "arrived_at" = "opened_at" WHERE "status" IN ('OPEN', 'CLOSING') AND "arrived_at" IS NULL;
