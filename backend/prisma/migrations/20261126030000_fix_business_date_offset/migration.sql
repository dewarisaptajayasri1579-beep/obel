-- business_date (DATE) on these tables was written with startOfTodayJakarta(), the UTC instant of
-- Jakarta midnight (17:00 UTC the day before), which Prisma truncated to the UTC date: every row
-- is one day early. The code now writes businessDateOf(); this moves existing rows to match.

-- Shift sessions: derive from the schedule (UTC values in a timestamp column), so rows that were
-- already correct (seed) stay as they are.
UPDATE "shift_sessions"
SET "business_date" = ("scheduled_start_at" + INTERVAL '7 hours')::date
WHERE "business_date" <> ("scheduled_start_at" + INTERVAL '7 hours')::date;

-- Attendance permits and stock opnames were only ever written by the old code
-- (a revised opname copies the date of the one it replaces).
UPDATE "attendance_permits" SET "business_date" = "business_date" + 1;
UPDATE "stock_opnames" SET "business_date" = "business_date" + 1;
