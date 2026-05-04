-- Add vendor profile fields
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS instagram TEXT;
