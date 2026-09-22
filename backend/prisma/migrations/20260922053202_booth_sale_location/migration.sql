-- AlterTable
ALTER TABLE "booths" ADD COLUMN     "address" TEXT,
ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "location_captured_at" TIMESTAMP(3),
ADD COLUMN     "longitude" DECIMAL(9,6);
