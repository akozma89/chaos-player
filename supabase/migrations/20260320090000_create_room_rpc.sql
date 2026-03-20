-- Migration: Create Room RPC
-- Provides a SECURITY DEFINER RPC to handle room creation, password storage, and host session setup in one atomic transaction.

CREATE OR REPLACE FUNCTION create_room(
  p_name       TEXT,
  p_host_id    UUID,
  p_username   TEXT,
  p_is_public  BOOLEAN DEFAULT TRUE,
  p_password   TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_code   TEXT;
  v_room        rooms%ROWTYPE;
  v_session     sessions%ROWTYPE;
  v_initial_tokens INT := 10;
BEGIN
  -- 1. Generate unique room code (6 chars, excluding confusing ones)
  LOOP
    v_room_code := (
      SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::int + 1, 1), '')
      FROM generate_series(1, 6)
    );
    EXIT WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE code = v_room_code);
  END LOOP;

  -- 2. Insert room
  INSERT INTO rooms (name, code, host_id, is_public, is_active)
  VALUES (p_name, v_room_code, p_host_id, p_is_public, true)
  RETURNING * INTO v_room;

  -- 3. Insert secret if private
  IF NOT p_is_public AND p_password IS NOT NULL THEN
    INSERT INTO room_secrets (room_id, password)
    VALUES (v_room.id, p_password);
  END IF;

  -- 4. Insert host session
  INSERT INTO sessions (room_id, user_id, username, tokens, is_host)
  VALUES (v_room.id, p_host_id, p_username, v_initial_tokens, true)
  RETURNING * INTO v_session;

  RETURN json_build_object(
    'room', json_build_object(
      'id',         v_room.id,
      'name',       v_room.name,
      'code',       v_room.code,
      'host_id',    v_room.host_id,
      'is_public',  v_room.is_public,
      'is_active',  v_room.is_active,
      'created_at', v_room.created_at,
      'updated_at', v_room.updated_at
    ),
    'session', json_build_object(
      'id', v_session.id
    )
  );
END;
$$;

-- Grant execute to authenticated and anon users
GRANT EXECUTE ON FUNCTION create_room(TEXT, UUID, TEXT, BOOLEAN, TEXT) TO authenticated, anon;
