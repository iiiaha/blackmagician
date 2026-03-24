-- ============================================
-- Migration: Soft Delete + 30-day Rejoin Ban
-- ============================================

-- 기존 delete_own_account 대체: soft delete 버전
CREATE OR REPLACE FUNCTION soft_delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get profile id
  SELECT id INTO v_profile_id
  FROM user_profiles
  WHERE auth_user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Soft delete: mark as deleted, set rejoin date 30 days from now
  UPDATE user_profiles
  SET
    deleted_at = now(),
    rejoin_available_at = now() + INTERVAL '30 days',
    plan = 'free',
    plan_expires_at = NULL
  WHERE id = v_profile_id;

  -- Delete favorites (non-essential data)
  DELETE FROM favorites WHERE user_id = v_profile_id;

  -- Delete apply logs
  DELETE FROM apply_logs WHERE user_id = v_profile_id;

  -- Delete download logs
  DELETE FROM download_logs WHERE user_id = v_profile_id;
END;
$$;
