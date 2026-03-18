-- Add source column to queue_items for YouTube/Spotify agnosticism
ALTER TABLE queue_items ADD COLUMN source TEXT NOT NULL DEFAULT 'youtube' CHECK (source IN ('youtube', 'spotify'));

-- Update existing items to 'youtube' (already handled by DEFAULT, but explicit for clarity)
UPDATE queue_items SET source = 'youtube' WHERE source IS NULL;
