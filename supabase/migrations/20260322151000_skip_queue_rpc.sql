-- New RPC for host-initiated skips.
-- Identical to advance_queue but marks the current item as 'skipped' instead of 'completed'.

CREATE OR REPLACE FUNCTION skip_queue(p_current_item_id UUID, p_room_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_id UUID;
BEGIN
  -- Mark current as skipped (no-op if already moved on)
  UPDATE queue_items SET status = 'skipped'
  WHERE id = p_current_item_id AND status = 'playing';

  -- Promote next pending item
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

  -- Prune old history: keep only the 10 most recent completed+skipped items
  DELETE FROM queue_items
  WHERE room_id = p_room_id
    AND status IN ('completed', 'skipped')
    AND id NOT IN (
      SELECT id FROM queue_items
      WHERE room_id = p_room_id AND status IN ('completed', 'skipped')
      ORDER BY added_at DESC
      LIMIT 10
    );
END;
$$;

GRANT EXECUTE ON FUNCTION skip_queue(UUID, UUID) TO authenticated, anon;
