-- CreateTable
CREATE TABLE "booth_shift_assignments" (
    "id" TEXT NOT NULL,
    "booth_id" TEXT NOT NULL,
    "shift_template_id" TEXT NOT NULL,
    "staff_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booth_shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booth_shift_assignments_booth_id_shift_template_id_key" ON "booth_shift_assignments"("booth_id", "shift_template_id");

-- AddForeignKey
ALTER TABLE "booth_shift_assignments" ADD CONSTRAINT "booth_shift_assignments_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_shift_assignments" ADD CONSTRAINT "booth_shift_assignments_shift_template_id_fkey" FOREIGN KEY ("shift_template_id") REFERENCES "shift_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_shift_assignments" ADD CONSTRAINT "booth_shift_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
