-- Color filter for product list. color_tags is an array of palette labels
-- (see src/lib/colors.ts) — Python ingestion fills it from thumbnail
-- analysis, vendor can override via grid + Excel.
ALTER TABLE products ADD COLUMN IF NOT EXISTS color_tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_products_color_tags_gin ON products USING GIN (color_tags);
