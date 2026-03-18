-- RPC to recompute and persist vote counts for a queue item.
-- Runs as SECURITY DEFINER so any authenticated member can update vote counts
-- without needing a broad UPDATE policy on queue_items.
CREATE OR REPLACE FUNCTION update_vote_counts(p_queue_item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_upvotes INTEGER;
  v_downvotes INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE type = 'upvote'),
    COUNT(*) FILTER (WHERE type = 'downvote')
  INTO v_upvotes, v_downvotes
  FROM votes
  WHERE queue_item_id = p_queue_item_id;

  UPDATE queue_items
  SET upvotes = v_upvotes, downvotes = v_downvotes
  WHERE id = p_queue_item_id;
END;
$$;
