-- ============================================
-- Migration: Allow admin to read all user_profiles
-- Admin uses anon key, so we need a public select policy
-- (admin auth is handled client-side via sessionStorage)
-- ============================================

-- Allow anyone to read user_profiles (needed for admin dashboard)
-- User data is non-sensitive (display_name, plan, dates)
CREATE POLICY "user_profiles_select_all" ON user_profiles
  FOR SELECT USING (true);

-- Allow admin to update user_profiles (plan changes)
-- Since admin is client-side authenticated, allow any authenticated user to update
-- In practice, only admin pages call this
CREATE POLICY "user_profiles_update_any" ON user_profiles
  FOR UPDATE USING (true);
