-- Migration: Private Rooms
-- Adds is_public flag to rooms and a room_secrets table for securely storing passwords.
-- Provides a SECURITY DEFINER RPC to allow joining private rooms with password verification.

-- 1. Add is_public to rooms (public by default for backwards compatibility)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Create room_secrets table to store hashed/plain passwords separately from rooms
--    (keeps passwords off the main rooms SELECT policy)
CREATE TABLE IF NOT EXISTS room_secrets (
  room_id UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  password TEXT NOT NULL
);

-- Deny all client access – only the SECURITY DEFINER function can read this
ALTER TABLE room_secrets ENABLE ROW LEVEL SECURITY;

-- 3. Update sessions INSERT policy so only public-room joins work directly;
--    private-room join goes through the RPC below.
DROP POLICY IF EXISTS "sessions_insert" ON sessions;

CREATE POLICY "sessions_insert" ON sessions FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    -- Public room: anyone may join
    EXISTS (SELECT 1 FROM rooms WHERE id = room_id AND is_public = true)
    OR
    -- Room host always allowed (creating session on room creation)
    EXISTS (SELECT 1 FROM rooms WHERE id = room_id AND host_id = auth.uid())
  )
);

-- 4. RPC: join_room
--    Handles both public and private rooms. For private rooms it checks the password.
--    Runs as SECURITY DEFINER so it can bypass RLS to insert into sessions and read room_secrets.
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

  -- Private room: verify password
  IF NOT v_room.is_public THEN
    -- Owner can always join without password
    IF v_room.host_id <> p_user_id THEN
      SELECT * INTO v_secret FROM room_secrets WHERE room_id = v_room.id;
      IF NOT FOUND OR p_password IS NULL OR v_secret.password <> p_password THEN
        RETURN json_build_object('error', 'Incorrect password');
      END IF;
    END IF;
  END IF;

  -- Insert or re-use session (upsert on conflict)
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
      'id',        v_room.id,
      'name',      v_room.name,
      'code',      v_room.code,
      'host_id',   v_room.host_id,
      'is_public', v_room.is_public,
      'is_active', v_room.is_active,
      'created_at', v_room.created_at,
      'updated_at', v_room.updated_at
    )
  );
END;
$$;

-- Grant execute to authenticated and anon users so they can call via PostgREST
GRANT EXECUTE ON FUNCTION join_room(TEXT, UUID, TEXT, TEXT) TO authenticated, anon;
