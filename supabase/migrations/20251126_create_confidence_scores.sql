CREATE TABLE confidence_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_key TEXT NOT NULL,
    char TEXT NOT NULL,
    skill_key TEXT NOT NULL DEFAULT 'general',
    served INT DEFAULT 0,
    correct INT DEFAULT 0,
    wrong INT DEFAULT 0,
    streak INT DEFAULT 0,
    last_wrong BIGINT,
    last_served BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(page_key, char, skill_key)
);

-- Index for fast lookups
CREATE INDEX idx_confidence_page_char ON confidence_scores(page_key, char);

-- Enable RLS
ALTER TABLE confidence_scores ENABLE ROW LEVEL SECURITY;

-- Allow all operations (since this is personal use, no auth needed)
CREATE POLICY "Allow all access" ON confidence_scores FOR ALL USING (true) WITH CHECK (true);
