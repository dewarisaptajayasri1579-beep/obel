-- CreateEnum
CREATE TYPE "CashDepositStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISCREPANCY');

-- AlterTable
ALTER TABLE "stock_returns" ADD COLUMN     "receive_note" TEXT,
ADD COLUMN     "shift_session_id" TEXT;

-- CreateTable
CREATE TABLE "shift_cash_deposits" (
    "id" TEXT NOT NULL,
    "shift_session_id" TEXT NOT NULL,
    "status" "CashDepositStatus" NOT NULL DEFAULT 'PENDING',
    "expected_amount" BIGINT NOT NULL,
    "deposited_amount" BIGINT,
    "note" TEXT,
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_cash_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_cash_deposits_shift_session_id_key" ON "shift_cash_deposits"("shift_session_id");

-- CreateIndex
CREATE INDEX "stock_returns_shift_session_id_idx" ON "stock_returns"("shift_session_id");

-- AddForeignKey
ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_shift_session_id_fkey" FOREIGN KEY ("shift_session_id") REFERENCES "shift_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_cash_deposits" ADD CONSTRAINT "shift_cash_deposits_shift_session_id_fkey" FOREIGN KEY ("shift_session_id") REFERENCES "shift_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_cash_deposits" ADD CONSTRAINT "shift_cash_deposits_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

