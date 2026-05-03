-- Single dominant color per product, mapped from the fixed palette in
-- src/lib/colors.ts. Python ingestion classifies each thumbnail into
-- one of 21 buckets; vendor can override via grid + Excel.
ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT;
CREATE INDEX IF NOT EXISTS idx_products_color ON products (color);
