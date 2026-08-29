-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('POSTED', 'REVERSED', 'SUPERSEDED');

-- AlterTable: payments.status was correction_status by mistake; convert to payment_status.
ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "status" TYPE "payment_status" USING ("status"::text::"payment_status");
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'POSTED';
