-- Absen GPS+Selfie (Check-In/Check-Out) pada ShiftSession, soft-check saja
-- terhadap Booth.latitude/longitude, tidak memblokir absen.
ALTER TABLE "shift_sessions"
  ADD COLUMN "check_in_latitude" DECIMAL(9,6),
  ADD COLUMN "check_in_longitude" DECIMAL(9,6),
  ADD COLUMN "check_in_photo_url" TEXT,
  ADD COLUMN "check_out_latitude" DECIMAL(9,6),
  ADD COLUMN "check_out_longitude" DECIMAL(9,6),
  ADD COLUMN "check_out_photo_url" TEXT;
