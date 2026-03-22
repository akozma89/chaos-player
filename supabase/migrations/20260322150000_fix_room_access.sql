-- Fix room access issues:
-- 1. Restore missing GRANT on create_room (dropped+recreated in 144600 without re-granting)
-- 2. Rebuild join_room to return all room fields added by later migrations
--    (is_paused, paused_at, skip_vote_count, allowed_resources were missing)

-- ============================================================
-- 1. Grant execute on create_room
-- ============================================================
GRANT EXECUTE ON FUNCTION create_room(TEXT, UUID, TEXT, BOOLEAN, TEXT, INTEGER, TEXT)
  TO authenticated, anon;

-- ============================================================
-- 2. Rebuild join_room with complete room return value
-- ============================================================
CREATE OR REPLACE FUNCTION join_room(
  p_room_code  TEXT,
  p_user_id    UUID,
  p_username   TEXT,
  p_password   TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room        rooms%ROWTYPE;
  v_secret      room_secrets%ROWTYPE;
  v_session     sessions%ROWTYPE;
  v_initial_tokens INT := 10;
BEGIN
  -- Look up room by code
  SELECT * INTO v_room FROM rooms WHERE code = p_room_code AND is_active = true;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Room not found');
  END IF;

  -- Private room: verify password (owner can always join without it)
  IF NOT v_room.is_public THEN
    IF v_room.host_id <> p_user_id THEN
      SELECT * INTO v_secret FROM room_secrets WHERE room_id = v_room.id;
      IF NOT FOUND OR p_password IS NULL OR v_secret.password <> p_password THEN
        RETURN json_build_object('error', 'Incorrect password');
      END IF;
    END IF;
  END IF;

  -- Upsert session (returning user keeps tokens, just username is refreshed)
  INSERT INTO sessions (room_id, user_id, username, tokens, is_host)
  VALUES (v_room.id, p_user_id, p_username, v_initial_tokens, v_room.host_id = p_user_id)
  ON CONFLICT (room_id, user_id)
  DO UPDATE SET username = EXCLUDED.username
  RETURNING * INTO v_session;

  RETURN json_build_object(
    'session', json_build_object(
      'id',        v_session.id,
      'room_id',   v_session.room_id,
      'user_id',   v_session.user_id,
      'username',  v_session.username,
      'tokens',    v_session.tokens,
      'is_host',   v_session.is_host,
      'joined_at', v_session.joined_at
    ),
    'room', json_build_object(
      'id',                v_room.id,
      'name',              v_room.name,
      'code',              v_room.code,
      'host_id',           v_room.host_id,
      'is_public',         v_room.is_public,
      'is_active',         v_room.is_active,
      'is_paused',         v_room.is_paused,
      'paused_at',         v_room.paused_at,
      'skip_vote_count',   v_room.skip_vote_count,
      'allowed_resources', v_room.allowed_resources,
      'created_at',        v_room.created_at,
      'updated_at',        v_room.updated_at
    )
  );
END;
$$;

-- Preserve grant (CREATE OR REPLACE on same signature keeps OID+grants,
-- but we re-state it explicitly to be safe)
GRANT EXECUTE ON FUNCTION join_room(TEXT, UUID, TEXT, TEXT) TO authenticated, anon;
