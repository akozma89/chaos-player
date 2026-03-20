-- Migration to ensure room_id exists in votes table
-- Fixes: column votes.room_id does not exist error reported by users.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'votes' AND column_name = 'room_id'
  ) THEN
    ALTER TABLE votes ADD COLUMN room_id UUID REFERENCES rooms(id) ON DELETE CASCADE;
    
    -- Back-fill room_id from queue_items
    UPDATE votes v
    SET room_id = q.room_id
    FROM queue_items q
    WHERE q.id = v.queue_item_id;
    
    -- Make non-nullable
    ALTER TABLE votes ALTER COLUMN room_id SET NOT NULL;
    
    -- Add index
    CREATE INDEX IF NOT EXISTS votes_room_id_idx ON votes(room_id);
  END IF;
END $$;
