-- Split product size into display-only "원장크기" (size) vs mapping "소스크기" (source_size).
-- Add thumbnail_zoom flag: when true, UI crops center 100×100 of natural image and scales to fill.
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_size TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS thumbnail_zoom BOOLEAN NOT NULL DEFAULT FALSE;
