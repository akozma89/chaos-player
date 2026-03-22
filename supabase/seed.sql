-- =============================================================================
-- Chaos Player — Seed Data
-- Runs automatically on: supabase db reset (local) and supabase db seed (remote)
-- Idempotent: uses ON CONFLICT DO NOTHING / DO UPDATE to survive re-runs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ChaosAdmin auth user
--    Fixed UUID so foreign keys remain stable across resets.
-- ---------------------------------------------------------------------------
-- Insert the auth user (idempotent on id)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  phone,
  phone_change,
  phone_change_token,
  reauthentication_token,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'chaosadmin@chaos-player.local',
  crypt('789741', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"ChaosAdmin"}',
  NOW(),
  NOW(),
  '', '', '', '', '', '', '', '', '',
  FALSE
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password         = crypt('789741', gen_salt('bf')),
  email_confirmed_at         = COALESCE(auth.users.email_confirmed_at, NOW()),
  email_change               = '',
  email_change_token_new     = '',
  email_change_token_current = '',
  phone                      = '',
  phone_change               = '',
  phone_change_token         = '',
  reauthentication_token     = '',
  updated_at                 = NOW();

-- Identity record required by Supabase Auth
-- Use a deterministic UUID derived from user id so it's stable across resets
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',  -- separate UUID from user id
  '00000000-0000-0000-0000-000000000001',
  'chaosadmin@chaos-player.local',
  'email',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"chaosadmin@chaos-player.local","email_verified":true,"provider":"email"}',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. ChaosAdmin profile
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (id, username, is_anonymous, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ChaosAdmin',
  FALSE,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, is_anonymous = FALSE;

-- ---------------------------------------------------------------------------
-- 3. Default public rooms owned by ChaosAdmin
--    Fixed UUIDs + fixed codes for stable deep-links.
-- ---------------------------------------------------------------------------
INSERT INTO public.rooms (id, name, code, host_id, is_active, is_public, skip_vote_count, allowed_resources, created_at, updated_at)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'The Main Stage',
    'MAIN01',
    '00000000-0000-0000-0000-000000000001',
    TRUE, TRUE, 3, 'youtube', NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Chill Vibes Lounge',
    'CHILL2',
    '00000000-0000-0000-0000-000000000001',
    TRUE, TRUE, 3, 'youtube', NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Hype Zone',
    'HYPE03',
    '00000000-0000-0000-0000-000000000001',
    TRUE, TRUE, 2, 'youtube', NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'Retro Beats',
    'RETRO4',
    '00000000-0000-0000-0000-000000000001',
    TRUE, TRUE, 2, 'youtube', NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'Late Night Sessions',
    'NIGHT5',
    '00000000-0000-0000-0000-000000000001',
    TRUE, TRUE, 3, 'youtube', NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    'Spotify Picks',
    'SPOT06',
    '00000000-0000-0000-0000-000000000001',
    TRUE, TRUE, 2, 'spotify', NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000007',
    'Chaos Radio',
    'RADIO7',
    '00000000-0000-0000-0000-000000000001',
    TRUE, TRUE, 2, 'youtube', NOW(), NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  name             = EXCLUDED.name,
  is_active        = EXCLUDED.is_active,
  skip_vote_count  = EXCLUDED.skip_vote_count,
  allowed_resources = EXCLUDED.allowed_resources,
  updated_at       = NOW();

-- ---------------------------------------------------------------------------
-- 4. Host sessions — ChaosAdmin is host in every default room
-- ---------------------------------------------------------------------------
INSERT INTO public.sessions (room_id, user_id, username, tokens, is_host, joined_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'ChaosAdmin', 10, TRUE, NOW()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'ChaosAdmin', 10, TRUE, NOW()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'ChaosAdmin', 10, TRUE, NOW()),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'ChaosAdmin', 10, TRUE, NOW()),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'ChaosAdmin', 10, TRUE, NOW()),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'ChaosAdmin', 10, TRUE, NOW()),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'ChaosAdmin', 10, TRUE, NOW())
ON CONFLICT (room_id, user_id) DO UPDATE SET is_host = TRUE;
