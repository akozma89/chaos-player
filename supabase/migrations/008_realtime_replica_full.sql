-- Add tokens table to realtime publication so token spend/earn events broadcast
ALTER PUBLICATION supabase_realtime ADD TABLE tokens;

-- Set Replica Identity Full for tables we filter on in realtime subscriptions
-- This ensures that UPDATE events carry the full row (including room_id) 
-- so that Supabase filters like `room_id=eq...` match successfully
ALTER TABLE sessions REPLICA IDENTITY FULL;
ALTER TABLE tokens REPLICA IDENTITY FULL;
ALTER TABLE votes REPLICA IDENTITY FULL;
ALTER TABLE queue_items REPLICA IDENTITY FULL;
