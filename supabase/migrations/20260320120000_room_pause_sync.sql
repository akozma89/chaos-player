-- Migration: Room Pause Sync
-- Adds pause state tracking to rooms to sync across all participants.

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

-- Ensure rooms are in the realtime publication
-- (Using a check because it might already be there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
  END IF;
END $$;

-- Set Replica Identity Full for the rooms table
-- This ensures Realtime updates carry all columns, essential for the id filter
ALTER TABLE rooms REPLICA IDENTITY FULL;

-- RPC to atomically toggle pause and adjust track timing
CREATE OR REPLACE FUNCTION toggle_room_pause(
  p_room_id UUID,
  p_pause   BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_paused_at TIMESTAMPTZ;
  v_pause_duration INTERVAL;
BEGIN
  -- Get current pause state
  SELECT paused_at INTO v_paused_at FROM rooms WHERE id = p_room_id;

  IF p_pause THEN
    -- Pausing: record the time
    UPDATE rooms 
    SET is_paused = true, 
        paused_at = now(),
        updated_at = now()
    WHERE id = p_room_id;
  ELSE
    -- Resuming: adjust playing_since for the active track
    IF v_paused_at IS NOT NULL THEN
      v_pause_duration := now() - v_paused_at;
      
      UPDATE queue_items 
      SET playing_since = playing_since + v_pause_duration
      WHERE room_id = p_room_id AND status = 'playing';
    END IF;

    UPDATE rooms 
    SET is_paused = false, 
        paused_at = null,
        updated_at = now()
    WHERE id = p_room_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_room_pause(UUID, BOOLEAN) TO authenticated, anon;
