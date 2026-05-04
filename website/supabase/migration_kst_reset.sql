-- ============================================
-- Migration: KST midnight reset for apply count
-- ============================================

CREATE OR REPLACE FUNCTION get_today_apply_count(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INT
  FROM apply_logs
  WHERE user_id = p_user_id
    AND applied_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date AT TIME ZONE 'Asia/Seoul'
    AND applied_at < ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Seoul';
$$;
