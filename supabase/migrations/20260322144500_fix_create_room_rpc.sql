-- Drop the incorrectly defined function from previous migration
DROP FUNCTION IF EXISTS create_room(varchar, boolean, text, integer, text);

CREATE OR REPLACE FUNCTION create_room(
  p_name varchar,
  p_host_id uuid,
  p_username varchar,
  p_is_public boolean DEFAULT true,
  p_password text DEFAULT NULL,
  p_skip_vote_count integer DEFAULT 2,
  p_allowed_resources text DEFAULT 'both'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_id uuid;
  v_code text;
BEGIN
  -- Generate unique 4-character code
  LOOP
    v_code := generate_room_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE code = v_code AND is_active = true);
  END LOOP;

  -- Create the room
  INSERT INTO rooms (
    name, 
    code, 
    host_id, 
    is_public, 
    password, 
    is_active,
    skip_vote_count,
    allowed_resources
  )
  VALUES (
    p_name, 
    v_code, 
    p_host_id, 
    p_is_public, 
    p_password, 
    true,
    p_skip_vote_count,
    p_allowed_resources
  )
  RETURNING id INTO v_room_id;

  -- Automatically join the host to the room
  INSERT INTO sessions (
    room_id, 
    user_id, 
    username, 
    is_host, 
    tokens
  )
  VALUES (
    v_room_id, 
    p_host_id, 
    p_username, 
    true, 
    100
  );

  RETURN v_room_id;
END;
$$;
