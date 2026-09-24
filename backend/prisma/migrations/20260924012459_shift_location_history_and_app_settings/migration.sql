-- CreateTable
CREATE TABLE "shift_location_pings" (
    "id" TEXT NOT NULL,
    "shift_session_id" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_location_pings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "gps_ping_interval_seconds" INTEGER NOT NULL DEFAULT 60,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_location_pings_shift_session_id_captured_at_idx" ON "shift_location_pings"("shift_session_id", "captured_at");

-- AddForeignKey
ALTER TABLE "shift_location_pings" ADD CONSTRAINT "shift_location_pings_shift_session_id_fkey" FOREIGN KEY ("shift_session_id") REFERENCES "shift_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
