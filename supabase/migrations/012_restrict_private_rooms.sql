-- Migration: Restrict Private Rooms
-- Updates the create_room RPC to ensure only registered (non-anonymous) users can create private rooms.

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
  v_is_anonymous BOOLEAN;
BEGIN
  -- 0. Security check: host must be the caller
  IF p_host_id != auth.uid() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- 1. Check if user is anonymous
  SELECT is_anonymous INTO v_is_anonymous FROM profiles WHERE id = p_host_id;
  
  -- Default to true if no profile exists (as only registered users should have a profile with is_anonymous=false)
  IF v_is_anonymous IS NULL THEN
    v_is_anonymous := TRUE;
  END IF;

  -- 2. Restrict private rooms to registered users
  IF NOT p_is_public AND v_is_anonymous THEN
    RETURN json_build_object('error', 'Only registered users can create private rooms');
  END IF;

  -- 3. Generate unique room code (6 chars, excluding confusing ones)
  LOOP
    v_room_code := (
      SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::int + 1, 1), '')
      FROM generate_series(1, 6)
    );
    EXIT WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE code = v_room_code);
  END LOOP;

  -- 4. Insert room
  INSERT INTO rooms (name, code, host_id, is_public, is_active)
  VALUES (p_name, v_room_code, p_host_id, p_is_public, true)
  RETURNING * INTO v_room;

  -- 5. Insert secret if private
  IF NOT p_is_public AND p_password IS NOT NULL THEN
    INSERT INTO room_secrets (room_id, password)
    VALUES (v_room.id, p_password);
  END IF;

  -- 6. Insert host session
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
