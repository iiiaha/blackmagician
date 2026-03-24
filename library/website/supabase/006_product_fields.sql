-- Change product fields: remove lead_time, moq, notes → add origin, brand, size
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS size TEXT;
-- Keep lead_time, moq, notes in DB for now (won't break anything), just won't be shown
