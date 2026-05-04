-- Add sort_order to vendors so admin can manually reorder within each category.
-- Seed values from current alphabetical order so existing layout is preserved
-- the moment the column appears.
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY company_name) - 1) AS rn
  FROM vendors
)
UPDATE vendors v SET sort_order = r.rn
FROM ranked r WHERE v.id = r.id;

-- New vendors append at end of their category instead of jumping to position 0.
CREATE OR REPLACE FUNCTION admin_create_vendor(
  p_login_id TEXT, p_password TEXT, p_company_name TEXT, p_category TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_vendor_id UUID;
  next_sort INTEGER;
BEGIN
  SELECT COALESCE(MAX(sort_order), -1) + 1 INTO next_sort
  FROM vendors WHERE category = p_category;

  INSERT INTO vendors (auth_user_id, company_name, category, login_id, password_hash, approved, contact_name, contact_phone, sort_order)
  VALUES (gen_random_uuid(), p_company_name, p_category, p_login_id, extensions.crypt(p_password, extensions.gen_salt('bf')), true, '', '', next_sort)
  RETURNING id INTO new_vendor_id;
  RETURN new_vendor_id;
END; $$;
