-- Migration: Host Skip Request and Democratic Veto

-- 1. Create skip_requests table
CREATE TABLE skip_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  queue_item_id UUID NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
  host_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'vetoed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  veto_threshold INTEGER DEFAULT 50 CHECK (veto_threshold >= 0 AND veto_threshold <= 100),
  UNIQUE(queue_item_id, host_id, status) -- Only one active request per item/host
);

-- 2. Create veto_votes table
CREATE TABLE veto_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skip_request_id UUID NOT NULL REFERENCES skip_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skip_request_id, user_id)
);

-- Enable RLS
ALTER TABLE skip_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE veto_votes ENABLE ROW LEVEL SECURITY;

-- skip_requests policies
CREATE POLICY "skip_requests_read" ON skip_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM sessions WHERE sessions.room_id = skip_requests.room_id AND sessions.user_id = auth.uid())
);
CREATE POLICY "skip_requests_host_insert" ON skip_requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM rooms WHERE rooms.id = skip_requests.room_id AND rooms.host_id = auth.uid())
);
CREATE POLICY "skip_requests_host_update" ON skip_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM rooms WHERE rooms.id = skip_requests.room_id AND rooms.host_id = auth.uid())
);

-- veto_votes policies
CREATE POLICY "veto_votes_read" ON veto_votes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM skip_requests sr
    JOIN sessions s ON s.room_id = sr.room_id
    WHERE sr.id = veto_votes.skip_request_id AND s.user_id = auth.uid()
  )
);
CREATE POLICY "veto_votes_insert" ON veto_votes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM skip_requests sr
    JOIN sessions s ON s.room_id = sr.room_id
    WHERE sr.id = veto_votes.skip_request_id AND s.user_id = auth.uid()
  )
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE skip_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE veto_votes;

-- 3. RPC to cast veto vote and check threshold
CREATE OR REPLACE FUNCTION cast_veto_vote(
  p_skip_request_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id UUID;
  v_veto_count INTEGER;
  v_session_count INTEGER;
  v_veto_threshold INTEGER;
  v_veto_percentage INTEGER;
  v_status TEXT;
BEGIN
  -- Get room_id and current status
  SELECT room_id, status, veto_threshold INTO v_room_id, v_status, v_veto_threshold
  FROM skip_requests WHERE id = p_skip_request_id;

  IF v_status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Request is no longer pending');
  END IF;

  -- Insert vote
  INSERT INTO veto_votes (skip_request_id, user_id)
  VALUES (p_skip_request_id, p_user_id)
  ON CONFLICT (skip_request_id, user_id) DO NOTHING;

  -- Calculate threshold
  SELECT COUNT(*) INTO v_veto_count FROM veto_votes WHERE skip_request_id = p_skip_request_id;
  SELECT COUNT(*) INTO v_session_count FROM sessions WHERE room_id = v_room_id;

  IF v_session_count > 0 THEN
    v_veto_percentage := (v_veto_count * 100) / v_session_count;
  ELSE
    v_veto_percentage := 0;
  END IF;

  IF v_veto_percentage >= v_veto_threshold THEN
    UPDATE skip_requests SET status = 'vetoed' WHERE id = p_skip_request_id;
    RETURN json_build_object('success', true, 'vetoed', true);
  END IF;

  RETURN json_build_object('success', true, 'vetoed', false);
END;
$$;

GRANT EXECUTE ON FUNCTION cast_veto_vote(UUID, UUID) TO authenticated, anon;
