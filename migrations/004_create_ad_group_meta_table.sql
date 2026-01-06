-- Migration: Create AdGroupMeta table
-- Description: Stores ad group metadata from VK Ads API

CREATE TABLE IF NOT EXISTS "AdGroupMeta" (
    "Id" INTEGER PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "AdPlanId" INTEGER NOT NULL,
    "Status" TEXT NOT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Idx_AdGroupMeta_AdPlanId" ON "AdGroupMeta"("AdPlanId");
CREATE INDEX IF NOT EXISTS "Idx_AdGroupMeta_Status" ON "AdGroupMeta"("Status");
CREATE INDEX IF NOT EXISTS "Idx_AdGroupMeta_UpdatedAt" ON "AdGroupMeta"("UpdatedAt" DESC);

-- Foreign key (optional, for referential integrity)
-- ALTER TABLE "AdGroupMeta" ADD CONSTRAINT "FK_AdGroupMeta_CampaignMeta"
--   FOREIGN KEY ("AdPlanId") REFERENCES "CampaignMeta"("Id") ON DELETE CASCADE;

-- Comments
COMMENT ON TABLE "AdGroupMeta" IS 'Ad group metadata from VK Ads API';
COMMENT ON COLUMN "AdGroupMeta"."Id" IS 'Ad group ID from VK Ads';
COMMENT ON COLUMN "AdGroupMeta"."Name" IS 'Ad group name';
COMMENT ON COLUMN "AdGroupMeta"."AdPlanId" IS 'Parent campaign ID';
COMMENT ON COLUMN "AdGroupMeta"."Status" IS 'Ad group status (active, blocked, etc.)';
COMMENT ON COLUMN "AdGroupMeta"."CreatedAt" IS 'Record creation timestamp';
COMMENT ON COLUMN "AdGroupMeta"."UpdatedAt" IS 'Record last update timestamp';
