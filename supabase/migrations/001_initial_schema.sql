-- Chaos Music Player: Initial Schema
-- Rooms: each collaborative listening session lives here
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code CHAR(6) UNIQUE NOT NULL,
  host_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions: one per user per room (anonymous or authenticated)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  tokens INTEGER DEFAULT 10 CHECK (tokens >= 0),
  is_host BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Queue items: YouTube tracks queued for playback
CREATE TABLE queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  duration INTEGER NOT NULL,
  added_by UUID NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  position INTEGER DEFAULT 0,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'playing', 'completed', 'skipped'))
);

-- Votes: one vote per user per queue item (upsertable)
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id UUID NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('upvote', 'downvote')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(queue_item_id, user_id)
);

-- Token ledger: track token spends for analytics
CREATE TABLE tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('skip', 'stop', 'boost')),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: rooms visible to all (public join via code)
CREATE POLICY "rooms_public_read" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_host_insert" ON rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "rooms_host_update" ON rooms FOR UPDATE USING (auth.uid() = host_id);

-- Sessions: users manage their own, host sees all in room
CREATE POLICY "sessions_own_read" ON sessions FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM rooms WHERE rooms.id = sessions.room_id AND rooms.host_id = auth.uid())
);
CREATE POLICY "sessions_insert" ON sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions_own_update" ON sessions FOR UPDATE USING (auth.uid() = user_id);

-- Queue items: readable by all in room, insertable by session members
CREATE POLICY "queue_public_read" ON queue_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM sessions WHERE sessions.room_id = queue_items.room_id AND sessions.user_id = auth.uid())
);
CREATE POLICY "queue_member_insert" ON queue_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM sessions WHERE sessions.room_id = queue_items.room_id AND sessions.user_id = auth.uid())
);
CREATE POLICY "queue_host_update" ON queue_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM rooms WHERE rooms.id = queue_items.room_id AND rooms.host_id = auth.uid())
);

-- Votes: members can vote, all members can read
CREATE POLICY "votes_member_read" ON votes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sessions s
    JOIN queue_items q ON q.room_id = s.room_id
    WHERE s.user_id = auth.uid() AND q.id = votes.queue_item_id
  )
);
CREATE POLICY "votes_member_upsert" ON votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_own_update" ON votes FOR UPDATE USING (auth.uid() = user_id);

-- Tokens: users see their own spend
CREATE POLICY "tokens_own_read" ON tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tokens_own_insert" ON tokens FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE queue_items;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
