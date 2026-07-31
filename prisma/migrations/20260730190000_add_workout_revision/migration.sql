-- A monotonically increasing server revision lets an installed PWA distinguish
-- a fresh IndexedDB snapshot from an older service-worker-rendered document.
ALTER TABLE "Workout"
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
