-- Migration 009: Add promote_item_by_id RPC
-- Allows any authenticated room member to promote a specific pending item.
-- Essential for democratic queue control and host-independent playback triggers.

CREATE OR REPLACE FUNCTION promote_item_by_id(p_item_id UUID, p_room_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Ensure nothing is currently playing in this room
  IF EXISTS (
    SELECT 1 FROM queue_items
    WHERE room_id = p_room_id AND status = 'playing'
  ) THEN
    -- If something is playing, we don't allow promoting another one (unless it's a skip, but that's handled by advance_queue)
    -- Actually, for a specific promotion, we might want to force it, but let's stick to safe bootstrap-like behavior first.
    RETURN;
  END IF;

  -- 2. Promote the specific item if it's pending in that room
  UPDATE queue_items
  SET status = 'playing',
      playing_since = NOW()
  WHERE id = p_item_id
    AND room_id = p_room_id
    AND status = 'pending';
END;
$$;
