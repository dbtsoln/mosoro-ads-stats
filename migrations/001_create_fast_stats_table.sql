-- Migration: Create FastStats table
-- Description: Stores minutely fast statistics from VK Ads API

CREATE TABLE IF NOT EXISTS "FastStats" (
    "Timestamp" TIMESTAMPTZ NOT NULL,
    "BannerId" INTEGER NOT NULL,
    "Shows" INTEGER NOT NULL DEFAULT 0,
    "Clicks" INTEGER NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY ("Timestamp", "BannerId"),
    CONSTRAINT "FastStats_Timestamp_BannerId_Unique" UNIQUE ("Timestamp", "BannerId")
);

-- Indexes for query optimization
CREATE INDEX IF NOT EXISTS "Idx_FastStats_BannerId" ON "FastStats"("BannerId");
CREATE INDEX IF NOT EXISTS "Idx_FastStats_Timestamp" ON "FastStats"("Timestamp" DESC);
CREATE INDEX IF NOT EXISTS "Idx_FastStats_CreatedAt" ON "FastStats"("CreatedAt" DESC);

-- Comment table and columns
COMMENT ON TABLE "FastStats" IS 'Minutely fast statistics from VK Ads API (last 60 minutes)';
COMMENT ON COLUMN "FastStats"."Timestamp" IS 'Minute timestamp (seconds and milliseconds are zero)';
COMMENT ON COLUMN "FastStats"."BannerId" IS 'VK Ads banner ID';
COMMENT ON COLUMN "FastStats"."Shows" IS 'Number of ad impressions';
COMMENT ON COLUMN "FastStats"."Clicks" IS 'Number of ad clicks';
COMMENT ON COLUMN "FastStats"."CreatedAt" IS 'Record creation timestamp';
COMMENT ON COLUMN "FastStats"."UpdatedAt" IS 'Record last update timestamp';
