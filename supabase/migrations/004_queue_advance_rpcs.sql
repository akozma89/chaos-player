-- RPCs to advance queue items without requiring host-level UPDATE access.
-- SECURITY DEFINER allows any authenticated room member to trigger these,
-- mirroring the pattern used by update_vote_counts.

-- Promote the top pending item in a room to 'playing' (bootstrap).
-- No-op if something is already playing.
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
    UPDATE queue_items SET status = 'playing' WHERE id = v_next_id;
  END IF;
END;
$$;

-- Mark current item completed, promote the next highest-voted pending item,
-- then prune completed history to the 10 most recent (by added_at).
-- Idempotent: safe to call concurrently from multiple clients.
CREATE OR REPLACE FUNCTION advance_queue(p_current_item_id UUID, p_room_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_id UUID;
BEGIN
  -- Mark current as completed (no-op if already completed/deleted)
  UPDATE queue_items SET status = 'completed'
  WHERE id = p_current_item_id AND status = 'playing';

  -- Promote next pending item
  SELECT id INTO v_next_id
  FROM queue_items
  WHERE room_id = p_room_id AND status = 'pending'
  ORDER BY (upvotes - downvotes) DESC, added_at ASC
  LIMIT 1;

  IF v_next_id IS NOT NULL THEN
    UPDATE queue_items SET status = 'playing' WHERE id = v_next_id;
  END IF;

  -- Prune completed history: keep only the 10 most recent
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
