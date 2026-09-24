-- AlterTable
ALTER TABLE "shift_sessions" ADD COLUMN     "last_location_at" TIMESTAMP(3),
ADD COLUMN     "last_location_latitude" DECIMAL(9,6),
ADD COLUMN     "last_location_longitude" DECIMAL(9,6);
