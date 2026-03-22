-- Migration: Host Read Secrets
-- Allows room hosts to read the secrets (passwords) for their own rooms.

CREATE POLICY "host_read_secrets" ON room_secrets
FOR SELECT TO authenticated, anon
USING (EXISTS (SELECT 1 FROM rooms WHERE id = room_id AND host_id = auth.uid()));
