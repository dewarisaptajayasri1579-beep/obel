-- checkIn() ended up using an "existing OPEN/CLOSING shift" check + the
-- shift_sessions_one_active_per_staff partial unique index for dedup/race
-- safety instead of a client-supplied idempotency key, so this column was
-- never actually written to. The partial unique index stays — only the
-- unused column + its own unique constraint are dropped here.
ALTER TABLE "shift_sessions" DROP CONSTRAINT "shift_sessions_idempotency_key_key";
ALTER TABLE "shift_sessions" DROP COLUMN "idempotency_key";
