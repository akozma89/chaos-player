-- RPC to transactional cast a vote and update counts
-- This ensures atomicity and bypasses client-side RLS issues for counts.
CREATE OR REPLACE FUNCTION cast_vote(
  p_queue_item_id UUID,
  p_user_id       UUID,
  p_room_id       UUID,
  p_type          TEXT -- 'upvote', 'downvote', or NULL to remove
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Remove existing vote if any
  DELETE FROM votes
  WHERE queue_item_id = p_queue_item_id AND user_id = p_user_id;

  -- 2. Insert new vote if not null
  IF p_type IS NOT NULL THEN
    INSERT INTO votes (queue_item_id, user_id, room_id, type, timestamp)
    VALUES (p_queue_item_id, p_user_id, p_room_id, p_type, NOW());
  END IF;

  -- 3. Update the queue_item totals
  -- (Using separate update_vote_counts logic inline for atomicity)
  UPDATE queue_items
  SET 
    upvotes = (SELECT COUNT(*) FROM votes WHERE queue_item_id = p_queue_item_id AND type = 'upvote'),
    downvotes = (SELECT COUNT(*) FROM votes WHERE queue_item_id = p_queue_item_id AND type = 'downvote')
  WHERE id = p_queue_item_id;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION cast_vote(UUID, UUID, UUID, TEXT) TO authenticated, anon;
