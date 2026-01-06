-- Migration: Create BannerMeta table
-- Description: Stores banner metadata from VK Ads API

CREATE TABLE IF NOT EXISTS "BannerMeta" (
    "Id" INTEGER PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "AdGroupId" INTEGER NOT NULL,
    "Textblocks" JSONB,
    "Status" TEXT NOT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Idx_BannerMeta_AdGroupId" ON "BannerMeta"("AdGroupId");
CREATE INDEX IF NOT EXISTS "Idx_BannerMeta_Status" ON "BannerMeta"("Status");
CREATE INDEX IF NOT EXISTS "Idx_BannerMeta_UpdatedAt" ON "BannerMeta"("UpdatedAt" DESC);

-- GIN index for JSONB textblocks (for fast JSON queries)
CREATE INDEX IF NOT EXISTS "Idx_BannerMeta_Textblocks" ON "BannerMeta" USING GIN ("Textblocks");

-- Foreign key (optional, for referential integrity)
-- ALTER TABLE "BannerMeta" ADD CONSTRAINT "FK_BannerMeta_AdGroupMeta"
--   FOREIGN KEY ("AdGroupId") REFERENCES "AdGroupMeta"("Id") ON DELETE CASCADE;

-- Comments
COMMENT ON TABLE "BannerMeta" IS 'Banner metadata from VK Ads API';
COMMENT ON COLUMN "BannerMeta"."Id" IS 'Banner ID from VK Ads';
COMMENT ON COLUMN "BannerMeta"."Name" IS 'Banner name';
COMMENT ON COLUMN "BannerMeta"."AdGroupId" IS 'Parent ad group ID';
COMMENT ON COLUMN "BannerMeta"."Textblocks" IS 'Banner textblocks in JSON format';
COMMENT ON COLUMN "BannerMeta"."Status" IS 'Banner status (active, blocked, etc.)';
COMMENT ON COLUMN "BannerMeta"."CreatedAt" IS 'Record creation timestamp';
COMMENT ON COLUMN "BannerMeta"."UpdatedAt" IS 'Record last update timestamp';
