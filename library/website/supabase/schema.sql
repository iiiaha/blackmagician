-- ============================================
-- Black Magician Library — Supabase DB Schema
-- ============================================

-- 1. Vendors (벤더 계정)
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL UNIQUE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  rejected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT one_account_per_company UNIQUE (company_name)
);

CREATE UNIQUE INDEX idx_vendors_auth_user ON vendors(auth_user_id);

-- 2. Folder Nodes (폴더 트리 — 관리자가 생성)
CREATE TABLE folder_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES folder_nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  depth INT NOT NULL DEFAULT 0,
  is_leaf BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_folder_nodes_vendor ON folder_nodes(vendor_id);
CREATE INDEX idx_folder_nodes_parent ON folder_nodes(parent_id);

-- 3. Products (제품 — 벤더가 생성하는 최하위 폴더)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES folder_nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stock INT,
  unit_price NUMERIC(12, 2),
  lead_time TEXT,
  moq INT,
  notes TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_vendor ON products(vendor_id);
CREATE INDEX idx_products_folder ON products(folder_id);

-- 4. Product Images (제품 이미지)
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_images_product ON product_images(product_id);

-- 5. User Profiles (Library 사용자)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  plan_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_user_profiles_auth_user ON user_profiles(auth_user_id);

-- 6. Download Logs (다운로드 기록)
CREATE TABLE download_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_download_logs_user_date ON download_logs(user_id, downloaded_at);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_logs ENABLE ROW LEVEL SECURITY;

-- Vendors: anyone can insert (registration), read own record
CREATE POLICY "vendors_insert" ON vendors
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "vendors_select_own" ON vendors
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "vendors_select_approved" ON vendors
  FOR SELECT USING (approved = true);

-- Admin policies (using service role or admin check via function)
-- For now, admin operations go through service role key or edge functions

-- Folder Nodes: vendors can read their own folders, all users can read for library browsing
CREATE POLICY "folder_nodes_select_all" ON folder_nodes
  FOR SELECT USING (true);

CREATE POLICY "folder_nodes_vendor_read" ON folder_nodes
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid())
  );

-- Products: vendors manage their own, all can read approved vendor products
CREATE POLICY "products_select_public" ON products
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM vendors WHERE approved = true)
  );

CREATE POLICY "products_vendor_insert" ON products
  FOR INSERT WITH CHECK (
    vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid() AND approved = true)
  );

CREATE POLICY "products_vendor_update" ON products
  FOR UPDATE USING (
    vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid() AND approved = true)
  );

CREATE POLICY "products_vendor_delete" ON products
  FOR DELETE USING (
    vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid() AND approved = true)
  );

-- Product Images: same pattern as products
CREATE POLICY "product_images_select_public" ON product_images
  FOR SELECT USING (true);

CREATE POLICY "product_images_vendor_insert" ON product_images
  FOR INSERT WITH CHECK (
    product_id IN (
      SELECT p.id FROM products p
      JOIN vendors v ON p.vendor_id = v.id
      WHERE v.auth_user_id = auth.uid() AND v.approved = true
    )
  );

CREATE POLICY "product_images_vendor_delete" ON product_images
  FOR DELETE USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN vendors v ON p.vendor_id = v.id
      WHERE v.auth_user_id = auth.uid() AND v.approved = true
    )
  );

-- User Profiles: users manage their own
CREATE POLICY "user_profiles_select_own" ON user_profiles
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (auth.uid() = auth_user_id);

-- Download Logs: users insert their own, read own
CREATE POLICY "download_logs_insert" ON download_logs
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "download_logs_select_own" ON download_logs
  FOR SELECT USING (
    user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

-- ============================================
-- Helper function: count today's downloads
-- ============================================
CREATE OR REPLACE FUNCTION get_today_download_count(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INT
  FROM download_logs
  WHERE user_id = p_user_id
    AND downloaded_at >= CURRENT_DATE
    AND downloaded_at < CURRENT_DATE + INTERVAL '1 day';
$$;

-- ============================================
-- Trigger: auto-update updated_at on products
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Storage bucket for product images
-- ============================================
-- Run this in Supabase Dashboard > Storage:
-- Create bucket: "product-images" (public)
--
-- Storage policies:
-- SELECT: public (anyone can read)
-- INSERT: authenticated users who are approved vendors
-- DELETE: authenticated users who own the files
