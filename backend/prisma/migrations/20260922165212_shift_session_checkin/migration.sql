-- Self-service check-in for booth staff (POST /shifts/check-in).
ALTER TABLE "shift_sessions" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "shift_sessions" ADD CONSTRAINT "shift_sessions_idempotency_key_key" UNIQUE ("idempotency_key");

-- One OPEN/CLOSING shift per staff member at a time, enforced at the DB
-- level (not just an application-side check) so a race between two
-- concurrent check-in calls can't both succeed. Partial unique index has
-- no declarative representation in schema.prisma; it lives only here.
CREATE UNIQUE INDEX "shift_sessions_one_active_per_staff"
  ON "shift_sessions" ("staff_id")
  WHERE "status" IN ('OPEN', 'CLOSING');
