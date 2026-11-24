-- Barista can request an early checkout (B4); Admin approves or rejects it. A permit row is
-- now either granted directly by Admin (status GRANTED, as before) or a request that starts as
-- REQUESTED. Existing rows were all granted by Admin, so the default keeps them valid.
CREATE TYPE "attendance_permit_status" AS ENUM ('REQUESTED', 'GRANTED', 'REJECTED');

ALTER TABLE "attendance_permits"
  ADD COLUMN "status" "attendance_permit_status" NOT NULL DEFAULT 'GRANTED',
  ADD COLUMN "decided_at" TIMESTAMP(3),
  ADD COLUMN "reject_reason" TEXT,
  ALTER COLUMN "granted_by" DROP NOT NULL;

-- At most one pending request per Barista per day.
CREATE UNIQUE INDEX "attendance_permits_one_request_per_day"
  ON "attendance_permits" ("staff_id", "business_date")
  WHERE "status" = 'REQUESTED';
