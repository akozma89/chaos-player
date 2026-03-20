CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  is_anonymous BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: readable by everyone
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (true);

-- Profiles: insertable by the owner
CREATE POLICY "profiles_own_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Profiles: updatable by the owner
CREATE POLICY "profiles_own_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger Function to clean up old contributor records when a name is fully registered
CREATE OR REPLACE FUNCTION cleanup_old_sessions() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_anonymous = FALSE THEN
    DELETE FROM sessions WHERE username = NEW.username AND user_id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trig_cleanup_old_sessions
AFTER INSERT OR UPDATE OF username, is_anonymous ON profiles
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_sessions();
