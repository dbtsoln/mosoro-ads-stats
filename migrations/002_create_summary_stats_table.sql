-- Migration: Create SummaryStats table
-- Description: Stores cumulative summary statistics from VK Ads API

CREATE TABLE IF NOT EXISTS "SummaryStats" (
    "Id" BIGSERIAL PRIMARY KEY,
    "Timestamp" TIMESTAMPTZ NOT NULL,
    "BannerId" INTEGER NOT NULL,
    "Shows" INTEGER NOT NULL DEFAULT 0,
    "Clicks" INTEGER NOT NULL DEFAULT 0,
    "Spent" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for query optimization
CREATE INDEX IF NOT EXISTS "Idx_SummaryStats_BannerId" ON "SummaryStats"("BannerId");
CREATE INDEX IF NOT EXISTS "Idx_SummaryStats_Timestamp" ON "SummaryStats"("Timestamp" DESC);
CREATE INDEX IF NOT EXISTS "Idx_SummaryStats_CreatedAt" ON "SummaryStats"("CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Idx_SummaryStats_BannerId_Timestamp" ON "SummaryStats"("BannerId", "Timestamp" DESC);

-- Comment table and columns
COMMENT ON TABLE "SummaryStats" IS 'Cumulative summary statistics from VK Ads API';
COMMENT ON COLUMN "SummaryStats"."Timestamp" IS 'Snapshot timestamp (rounded to minute)';
COMMENT ON COLUMN "SummaryStats"."BannerId" IS 'VK Ads banner ID';
COMMENT ON COLUMN "SummaryStats"."Shows" IS 'Total number of ad impressions';
COMMENT ON COLUMN "SummaryStats"."Clicks" IS 'Total number of ad clicks';
COMMENT ON COLUMN "SummaryStats"."Spent" IS 'Total amount spent (in rubles)';
COMMENT ON COLUMN "SummaryStats"."CreatedAt" IS 'Record creation timestamp';
