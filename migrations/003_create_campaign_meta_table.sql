-- Migration: Create CampaignMeta table
-- Description: Stores campaign metadata from VK Ads API

CREATE TABLE IF NOT EXISTS "CampaignMeta" (
    "Id" INTEGER PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "Status" TEXT NOT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Idx_CampaignMeta_Status" ON "CampaignMeta"("Status");
CREATE INDEX IF NOT EXISTS "Idx_CampaignMeta_UpdatedAt" ON "CampaignMeta"("UpdatedAt" DESC);

-- Comments
COMMENT ON TABLE "CampaignMeta" IS 'Campaign metadata from VK Ads API (ad_plans)';
COMMENT ON COLUMN "CampaignMeta"."Id" IS 'Campaign ID from VK Ads';
COMMENT ON COLUMN "CampaignMeta"."Name" IS 'Campaign name';
COMMENT ON COLUMN "CampaignMeta"."Status" IS 'Campaign status (active, blocked, etc.)';
COMMENT ON COLUMN "CampaignMeta"."CreatedAt" IS 'Record creation timestamp';
COMMENT ON COLUMN "CampaignMeta"."UpdatedAt" IS 'Record last update timestamp';
