-- Migration: Drop old tables with snake_case naming
-- Description: Remove old tables before creating new ones with PascalCase

DROP TABLE IF EXISTS fast_stats;
DROP TABLE IF EXISTS summary_stats;
