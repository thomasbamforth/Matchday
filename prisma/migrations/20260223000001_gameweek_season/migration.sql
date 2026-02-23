-- Add season and seasonNumber to Gameweek
ALTER TABLE "Gameweek" ADD COLUMN "season" INTEGER NOT NULL DEFAULT 2024;
ALTER TABLE "Gameweek" ADD COLUMN "seasonNumber" INTEGER NOT NULL DEFAULT 0;
-- Backfill: existing rows are 2024/25 season, seasonNumber = number (1-38)
UPDATE "Gameweek" SET "seasonNumber" = "number" WHERE "season" = 2024;
