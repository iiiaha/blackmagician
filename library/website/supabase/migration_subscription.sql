-- ============================================
-- Migration: Subscription & Usage Tracking
-- ============================================

-- 1. user_profiles에 구독 관련 필드 추가
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejoin_available_at TIMESTAMPTZ;

-- plan 체크 제약 업데이트 (premium → pro)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_plan_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_plan_check
  CHECK (plan IN ('free', 'pro'));

-- 기존 premium → free로 초기화
UPDATE user_profiles SET plan = 'free' WHERE plan = 'premium';

-- 2. apply_logs 테이블 (Apply to Bucket 사용 기록)
CREATE TABLE IF NOT EXISTS apply_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apply_logs_user_date ON apply_logs(user_id, applied_at);

-- RLS
ALTER TABLE apply_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apply_logs_insert" ON apply_logs
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "apply_logs_select_own" ON apply_logs
  FOR SELECT USING (
    user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

-- 3. 오늘의 apply 횟수 조회 함수
CREATE OR REPLACE FUNCTION get_today_apply_count(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INT
  FROM apply_logs
  WHERE user_id = p_user_id
    AND applied_at >= CURRENT_DATE
    AND applied_at < CURRENT_DATE + INTERVAL '1 day';
$$;

-- 4. 탈퇴 사용자 재가입 체크 함수
CREATE OR REPLACE FUNCTION check_rejoin_allowed(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN auth.users au ON up.auth_user_id = au.id
    WHERE au.email = p_email
      AND up.deleted_at IS NOT NULL
      AND up.rejoin_available_at > now()
  );
$$;
