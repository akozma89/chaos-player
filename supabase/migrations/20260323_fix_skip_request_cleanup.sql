-- Fix skip_request cleanup and auto-expiry

-- 1. Add DELETE policy for hosts to clean up old skip requests
CREATE POLICY "skip_requests_host_delete" ON skip_requests FOR DELETE USING (
  EXISTS (SELECT 1 FROM rooms WHERE rooms.id = skip_requests.room_id AND rooms.host_id = auth.uid())
);

-- 2. Create function to auto-approve expired skip requests and skip the tracks
CREATE OR REPLACE FUNCTION approve_expired_skip_requests(p_room_id uuid)
RETURNS TABLE(items_skipped int, requests_approved int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_items_skipped int := 0;
  v_requests_approved int := 0;
BEGIN
  -- Mark items as skipped if their skip requests have expired and are still pending
  UPDATE queue_items
  SET status = 'skipped'
  WHERE id IN (
    SELECT queue_item_id
    FROM skip_requests
    WHERE room_id = p_room_id
      AND status = 'pending'
      AND expires_at <= NOW()
  );
  GET DIAGNOSTICS v_items_skipped = ROW_COUNT;

  -- Mark expired skip requests as approved
  UPDATE skip_requests
  SET status = 'approved'
  WHERE room_id = p_room_id
    AND status = 'pending'
    AND expires_at <= NOW();
  GET DIAGNOSTICS v_requests_approved = ROW_COUNT;

  RETURN QUERY SELECT v_items_skipped, v_requests_approved;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_expired_skip_requests(uuid) TO authenticated, anon;
