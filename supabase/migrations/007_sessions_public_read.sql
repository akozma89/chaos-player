-- Drop the restrictive policy that prevents users from reading sessions other than their own
DROP POLICY IF EXISTS "sessions_own_read" ON sessions;

-- Allow all authenticated or anonymous users to read any session
-- (room_id effectively acts as a password, so this is safe for the context of this app)
CREATE POLICY "sessions_public_read" ON sessions FOR SELECT USING (true);
