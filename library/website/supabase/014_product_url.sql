-- Per-product detail page URL. Surfaces in the user-facing preview
-- panel as "상세페이지" link; vendor enters via grid + Excel.
ALTER TABLE products ADD COLUMN IF NOT EXISTS url TEXT;
