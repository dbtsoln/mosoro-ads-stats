-- Migration: Create CampaignHistory table
-- Description: Stores campaign history snapshots from VK Ads API

CREATE TABLE IF NOT EXISTS "CampaignHistory" (
    "Id" INTEGER NOT NULL,
    "Bid" DECIMAL(10, 2),
    "Delivery" TEXT,
    "Status" TEXT NOT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL,
    "UpdatedAt" TIMESTAMPTZ NOT NULL,
    "InsertedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("Id", "UpdatedAt")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Idx_CampaignHistory_Id" ON "CampaignHistory"("Id");
CREATE INDEX IF NOT EXISTS "Idx_CampaignHistory_UpdatedAt" ON "CampaignHistory"("UpdatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Idx_CampaignHistory_Status" ON "CampaignHistory"("Status");

-- Comments
COMMENT ON TABLE "CampaignHistory" IS 'Campaign history snapshots from VK Ads API (ad_plans)';
COMMENT ON COLUMN "CampaignHistory"."Id" IS 'Campaign ID from VK Ads';
COMMENT ON COLUMN "CampaignHistory"."Bid" IS 'Campaign bid price (from price field in API)';
COMMENT ON COLUMN "CampaignHistory"."Delivery" IS 'Campaign delivery status (from delivery field in API)';
COMMENT ON COLUMN "CampaignHistory"."Status" IS 'Campaign status (active, blocked, etc.)';
COMMENT ON COLUMN "CampaignHistory"."CreatedAt" IS 'Campaign creation timestamp from API (from created field)';
COMMENT ON COLUMN "CampaignHistory"."UpdatedAt" IS 'Campaign update timestamp from API (from updated field)';
COMMENT ON COLUMN "CampaignHistory"."InsertedAt" IS 'Record insertion timestamp in our database';
