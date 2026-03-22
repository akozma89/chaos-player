-- Migration: Skip Votes and Room Settings

-- 1. Add columns to rooms table
ALTER TABLE rooms
ADD COLUMN skip_vote_percentage INTEGER DEFAULT 50 CHECK (skip_vote_percentage >= 0 AND skip_vote_percentage <= 100),
ADD COLUMN allowed_resources TEXT DEFAULT 'both' CHECK (allowed_resources IN ('youtube', 'spotify', 'both'));

-- 2. Create skip_votes table
CREATE TABLE skip_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  queue_item_id UUID NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(queue_item_id, user_id)
);

-- Enable RLS on skip_votes
ALTER TABLE skip_votes ENABLE ROW LEVEL SECURITY;

-- skip_votes: members can vote if they are in the session
CREATE POLICY "skip_votes_member_read" ON skip_votes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.user_id = auth.uid() AND s.room_id = skip_votes.room_id
  )
);
CREATE POLICY "skip_votes_member_insert" ON skip_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "skip_votes_own_delete" ON skip_votes FOR DELETE USING (auth.uid() = user_id);

-- Enable Realtime for skip_votes
ALTER PUBLICATION supabase_realtime ADD TABLE skip_votes;

-- 3. Update create_room RPC to handle skip_vote_percentage and allowed_resources
-- Drop old function to cleanly recreate with new args
DROP FUNCTION IF EXISTS create_room(TEXT, UUID, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION create_room(
  p_name       TEXT,
  p_host_id    UUID,
  p_username   TEXT,
  p_is_public  BOOLEAN DEFAULT TRUE,
  p_password   TEXT DEFAULT NULL,
  p_skip_vote_percentage INTEGER DEFAULT 50,
  p_allowed_resources TEXT DEFAULT 'both'
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
  INSERT INTO rooms (name, code, host_id, is_public, is_active, skip_vote_percentage, allowed_resources)
  VALUES (p_name, v_room_code, p_host_id, p_is_public, true, p_skip_vote_percentage, p_allowed_resources)
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
      'updated_at', v_room.updated_at,
      'skip_vote_percentage', v_room.skip_vote_percentage,
      'allowed_resources', v_room.allowed_resources
    ),
    'session', json_build_object(
      'id', v_session.id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_room(TEXT, UUID, TEXT, BOOLEAN, TEXT, INTEGER, TEXT) TO authenticated, anon;

-- 4. Create toggle_skip_vote RPC
CREATE OR REPLACE FUNCTION toggle_skip_vote(
  p_queue_item_id UUID,
  p_user_id UUID,
  p_room_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
  v_skip_count INTEGER;
  v_session_count INTEGER;
  v_skip_percentage INTEGER;
  v_room_threshold INTEGER;
BEGIN
  -- Check if vote exists
  SELECT EXISTS(
    SELECT 1 FROM skip_votes
    WHERE queue_item_id = p_queue_item_id AND user_id = p_user_id
  ) INTO v_exists;

  IF v_exists THEN
    -- Remove the vote
    DELETE FROM skip_votes WHERE queue_item_id = p_queue_item_id AND user_id = p_user_id;
  ELSE
    -- Add the vote
    INSERT INTO skip_votes(room_id, queue_item_id, user_id)
    VALUES(p_room_id, p_queue_item_id, p_user_id);
  END IF;

  -- Check threshold
  SELECT COUNT(*) INTO v_skip_count 
  FROM skip_votes WHERE queue_item_id = p_queue_item_id;

  SELECT COUNT(*) INTO v_session_count 
  FROM sessions WHERE room_id = p_room_id;

  SELECT skip_vote_percentage INTO v_room_threshold 
  FROM rooms WHERE id = p_room_id;

  IF v_session_count > 0 THEN
    v_skip_percentage := (v_skip_count * 100) / v_session_count;
  ELSE
    v_skip_percentage := 0;
  END IF;

  IF v_skip_percentage >= v_room_threshold THEN
    -- mark as skipped if currently playing
    -- Wait, if threshold is met, we just set status='skipped'. The client/server handles the next logic via realtime
    UPDATE queue_items 
    SET status = 'skipped' 
    WHERE id = p_queue_item_id AND status = 'playing';
    
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;

  RETURN json_build_object('success', true, 'skipped', false);
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_skip_vote(UUID, UUID, UUID) TO authenticated, anon;
