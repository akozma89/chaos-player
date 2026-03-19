-- Migration 006: Add room_id to votes table for faster RLS lookups
-- Fixes: votes subscription was disabled because room_id was absent.
-- With room_id denormalized, Realtime filters can use room_id=eq.<roomId>
-- directly without joining queue_items (which costs a seq scan per RLS eval).

ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE CASCADE;

-- Back-fill from queue_items (safe for existing rows)
UPDATE votes
SET room_id = q.room_id
FROM queue_items q
WHERE q.id = votes.queue_item_id;

-- Make non-nullable after back-fill
ALTER TABLE votes
  ALTER COLUMN room_id SET NOT NULL;

-- Index for room-scoped lookups
CREATE INDEX IF NOT EXISTS votes_room_id_idx ON votes(room_id);

-- Tighten RLS: replace join-based read policy with direct room_id check (10x faster)
DROP POLICY IF EXISTS "votes_member_read" ON votes;
CREATE POLICY "votes_member_read" ON votes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.user_id = auth.uid()
      AND s.room_id = votes.room_id
  )
);

-- Allow members to insert votes (room_id must match a session they own)
DROP POLICY IF EXISTS "votes_member_upsert" ON votes;
CREATE POLICY "votes_member_insert" ON votes FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.user_id = auth.uid() AND s.room_id = votes.room_id
  )
);
