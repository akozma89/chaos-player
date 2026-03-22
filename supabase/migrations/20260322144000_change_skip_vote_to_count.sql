-- 1. Rename column in rooms
ALTER TABLE rooms RENAME COLUMN skip_vote_percentage TO skip_vote_count;
ALTER TABLE rooms ALTER COLUMN skip_vote_count SET DEFAULT 2;

-- 2. Update create_room RPC
DROP FUNCTION IF EXISTS create_room(character varying, boolean, text, integer, text);

CREATE OR REPLACE FUNCTION create_room(
  p_name character varying,
  p_is_public boolean DEFAULT true,
  p_password text DEFAULT NULL,
  p_skip_vote_count integer DEFAULT 2,
  p_allowed_resources text DEFAULT 'both'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_id uuid;
  v_code text;
BEGIN
  -- Generate unique 4-character code
  LOOP
    v_code := generate_room_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE code = v_code AND is_active = true);
  END LOOP;

  INSERT INTO rooms (
    name, 
    code, 
    host_id, 
    is_public, 
    password, 
    is_active,
    skip_vote_count,
    allowed_resources
  )
  VALUES (
    p_name, 
    v_code, 
    auth.uid(), 
    p_is_public, 
    p_password, 
    true,
    p_skip_vote_count,
    p_allowed_resources
  )
  RETURNING id INTO v_room_id;

  RETURN v_room_id;
END;
$$;

-- 3. Update toggle_skip_vote RPC to use count logic
CREATE OR REPLACE FUNCTION toggle_skip_vote(
  p_queue_item_id uuid,
  p_user_id uuid,
  p_room_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_vote record;
  v_skip_count int;
  v_active_sessions int;
  v_room_skip_count int;
  v_skip_threshold int;
  v_was_skipped boolean := false;
BEGIN
  -- Delete existing vote from this user for this track, if it exists
  SELECT * INTO v_existing_vote 
  FROM skip_votes 
  WHERE queue_item_id = p_queue_item_id AND user_id = p_user_id;

  IF FOUND THEN
    DELETE FROM skip_votes 
    WHERE queue_item_id = p_queue_item_id AND user_id = p_user_id;
  ELSE
    -- Add skip vote
    INSERT INTO skip_votes (queue_item_id, user_id, room_id)
    VALUES (p_queue_item_id, p_user_id, p_room_id);
  END IF;

  -- Get total skip votes for the track
  SELECT COUNT(*) INTO v_skip_count
  FROM skip_votes
  WHERE queue_item_id = p_queue_item_id;

  -- Get active session count for the room
  SELECT COUNT(*) INTO v_active_sessions
  FROM sessions
  WHERE room_id = p_room_id;

  -- Get room skip vote config
  SELECT skip_vote_count INTO v_room_skip_count
  FROM rooms
  WHERE id = p_room_id;

  -- Calculate threshold: min(config count, active sessions)
  IF v_active_sessions > 0 THEN
    -- if configured count is greater than all active users, cap it
    IF v_room_skip_count > v_active_sessions THEN
      v_skip_threshold := v_active_sessions;
    ELSE
      v_skip_threshold := v_room_skip_count;
    END IF;

    -- If we meet or exceed the threshold, mark as skipped
    IF v_skip_count >= v_skip_threshold THEN
      UPDATE queue_items
      SET status = 'skipped'
      WHERE id = p_queue_item_id AND status = 'playing';

      v_was_skipped := true;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'skipped', v_was_skipped
  );
END;
$$;
