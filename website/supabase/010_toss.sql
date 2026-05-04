-- Stripe → 토스페이먼츠 전환
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS toss_customer_key TEXT,
  ADD COLUMN IF NOT EXISTS toss_billing_key TEXT;
