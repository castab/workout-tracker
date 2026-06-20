CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "role" "UserRole";

WITH ordered_users AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS row_number
  FROM "User"
)
UPDATE "User"
SET
  "username" = CASE
    WHEN ordered_users.row_number = 1 THEN 'admin'
    ELSE 'user-' || ordered_users.row_number::text
  END,
  "role" = CASE
    WHEN ordered_users.row_number = 1 THEN 'ADMIN'::"UserRole"
    ELSE 'USER'::"UserRole"
  END
FROM ordered_users
WHERE "User"."id" = ordered_users."id";

ALTER TABLE "User"
  ALTER COLUMN "username" SET NOT NULL,
  ALTER COLUMN "role" SET NOT NULL,
  ALTER COLUMN "role" SET DEFAULT 'USER';

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_single_admin_key" ON "User"("role") WHERE "role" = 'ADMIN';

ALTER TABLE "Workout" ADD COLUMN "userId" TEXT;

UPDATE "Workout"
SET "userId" = (
  SELECT "id"
  FROM "User"
  ORDER BY "createdAt" ASC, "id" ASC
  LIMIT 1
)
WHERE "userId" IS NULL;

ALTER TABLE "Workout" ALTER COLUMN "userId" SET NOT NULL;

CREATE INDEX "Workout_userId_idx" ON "Workout"("userId");

ALTER TABLE "Workout"
  ADD CONSTRAINT "Workout_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
