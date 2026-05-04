-- Vendor profile extensions
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Vendor can update own profile
CREATE POLICY "vendors_update_own" ON vendors
  FOR UPDATE USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);
