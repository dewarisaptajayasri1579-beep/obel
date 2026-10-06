-- Rename the system access role so it no longer reads like an account type ("Admin Pusat" vs the Admin account).
-- Matched by its full_access flag, so the code never depends on the name.
UPDATE "access_roles"
SET "name" = 'Akses Penuh', "updated_at" = CURRENT_TIMESTAMP
WHERE "full_access" = true AND "name" = 'Admin Pusat';
