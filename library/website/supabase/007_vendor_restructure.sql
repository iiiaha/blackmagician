-- ============================================
-- Vendor Restructure: Admin-managed accounts
-- ============================================

-- 1. Add new fields to vendors
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS login_id TEXT UNIQUE;

-- 2. Remove approved/rejected (no longer needed)
-- Keep columns in DB but won't use them

-- 3. Function: Admin creates vendor + auth user in one call
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION admin_create_vendor(
  p_login_id TEXT,
  p_password TEXT,
  p_company_name TEXT,
  p_category TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_uid UUID;
  new_vendor_id UUID;
BEGIN
  -- Create auth user
  new_uid := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_uid, 'authenticated', 'authenticated', p_login_id,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(), ''
  );

  -- Create identity
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    new_uid, new_uid,
    jsonb_build_object('sub', new_uid::text, 'email', p_login_id),
    'email', new_uid::text,
    now(), now(), now()
  );

  -- Create vendor
  INSERT INTO vendors (
    auth_user_id, company_name, category, login_id, approved
  ) VALUES (
    new_uid, p_company_name, p_category, p_login_id, true
  ) RETURNING id INTO new_vendor_id;

  RETURN new_vendor_id;
END;
$$;

-- 4. Function: Admin deletes vendor + auth user
CREATE OR REPLACE FUNCTION admin_delete_vendor(p_vendor_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id UUID;
BEGIN
  SELECT auth_user_id INTO v_auth_user_id FROM vendors WHERE id = p_vendor_id;
  IF v_auth_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_user_id;
  END IF;
END;
$$;

-- 5. Function: Admin resets vendor password
CREATE OR REPLACE FUNCTION admin_reset_vendor_password(p_vendor_id UUID, p_new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id UUID;
BEGIN
  SELECT auth_user_id INTO v_auth_user_id FROM vendors WHERE id = p_vendor_id;
  IF v_auth_user_id IS NOT NULL THEN
    UPDATE auth.users SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
    WHERE id = v_auth_user_id;
  END IF;
END;
$$;

-- 6. Simplify folder_nodes: remove is_leaf (all folders can have products)
-- Keep column but ignore it in new UI
