-- Favorites table (per user, per product, per category)
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_favorites_user_category ON favorites(user_id, category);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_select_own" ON favorites
  FOR SELECT USING (
    user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "favorites_insert_own" ON favorites
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "favorites_delete_own" ON favorites
  FOR DELETE USING (
    user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
  );
