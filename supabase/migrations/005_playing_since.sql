-- Add playing_since to track when a track started playing.
-- Used by clients to seek to the correct position on join/reconnect.
ALTER TABLE queue_items ADD COLUMN playing_since TIMESTAMPTZ;

-- Update RPCs to stamp playing_since when promoting a track.
CREATE OR REPLACE FUNCTION promote_to_playing(p_room_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM queue_items
    WHERE room_id = p_room_id AND status = 'playing'
  ) THEN
    RETURN;
  END IF;

  SELECT id INTO v_next_id
  FROM queue_items
  WHERE room_id = p_room_id AND status = 'pending'
  ORDER BY (upvotes - downvotes) DESC, added_at ASC
  LIMIT 1;

  IF v_next_id IS NOT NULL THEN
    UPDATE queue_items
    SET status = 'playing', playing_since = NOW()
    WHERE id = v_next_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION advance_queue(p_current_item_id UUID, p_room_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_id UUID;
BEGIN
  UPDATE queue_items SET status = 'completed'
  WHERE id = p_current_item_id AND status = 'playing';

  SELECT id INTO v_next_id
  FROM queue_items
  WHERE room_id = p_room_id AND status = 'pending'
  ORDER BY (upvotes - downvotes) DESC, added_at ASC
  LIMIT 1;

  IF v_next_id IS NOT NULL THEN
    UPDATE queue_items
    SET status = 'playing', playing_since = NOW()
    WHERE id = v_next_id;
  END IF;

  DELETE FROM queue_items
  WHERE room_id = p_room_id
    AND status = 'completed'
    AND id NOT IN (
      SELECT id FROM queue_items
      WHERE room_id = p_room_id AND status = 'completed'
      ORDER BY added_at DESC
      LIMIT 10
    );
END;
$$;
