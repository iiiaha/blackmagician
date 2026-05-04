-- Simple vendor auth: password stored in vendors table directly
-- No more auth.users dependency for vendors

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Create vendor (simple - no auth.users)
CREATE OR REPLACE FUNCTION admin_create_vendor(
  p_login_id TEXT, p_password TEXT, p_company_name TEXT, p_category TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_vendor_id UUID;
BEGIN
  INSERT INTO vendors (auth_user_id, company_name, category, login_id, password_hash, approved, contact_name, contact_phone)
  VALUES (gen_random_uuid(), p_company_name, p_category, p_login_id, extensions.crypt(p_password, extensions.gen_salt('bf')), true, '', '')
  RETURNING id INTO new_vendor_id;
  RETURN new_vendor_id;
END; $$;

-- Verify vendor login
CREATE OR REPLACE FUNCTION verify_vendor_login(p_login_id TEXT, p_password TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID; v_hash TEXT;
BEGIN
  SELECT id, password_hash INTO v_id, v_hash FROM vendors WHERE login_id = p_login_id;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  IF v_hash = extensions.crypt(p_password, v_hash) THEN RETURN v_id;
  ELSE RETURN NULL; END IF;
END; $$;

-- Reset vendor password
CREATE OR REPLACE FUNCTION admin_reset_vendor_password(p_vendor_id UUID, p_new_password TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE vendors SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')) WHERE id = p_vendor_id;
END; $$;

-- Delete vendor (simple)
CREATE OR REPLACE FUNCTION admin_delete_vendor(p_vendor_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM vendors WHERE id = p_vendor_id;
END; $$;
