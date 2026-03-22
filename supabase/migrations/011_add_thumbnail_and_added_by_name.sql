-- Add thumbnail_url and added_by_name to queue_items
ALTER TABLE queue_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE queue_items ADD COLUMN IF NOT EXISTS added_by_name TEXT;

-- Update existing rows if possible (optional, but good for consistency)
-- This might not work if we don't have a way to easily map added_by to a name here, 
-- but we can leave it null for old items.
