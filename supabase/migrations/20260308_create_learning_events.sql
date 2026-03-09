CREATE TABLE IF NOT EXISTS learning_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    ts BIGINT NOT NULL,
    session_id TEXT NOT NULL,
    page_key TEXT NOT NULL,
    char TEXT NOT NULL,
    pinyin TEXT,
    meaning TEXT,
    mode TEXT NOT NULL,
    skill TEXT NOT NULL,
    scheduler TEXT NOT NULL,
    correct BOOLEAN NOT NULL,
    response_ms INT,
    attempt_num INT DEFAULT 0,
    total_correct INT DEFAULT 0,
    total_wrong INT DEFAULT 0,
    streak INT DEFAULT 0,
    bkt_p_learned DOUBLE PRECISION,
    half_life_hours DOUBLE PRECISION,
    feed_attempts INT,
    feed_correct INT,
    recall_prob DOUBLE PRECISION,
    hand_size INT,
    pool_size INT,
    graduated_count INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_events_user_ts ON learning_events(user_id, ts DESC);
CREATE INDEX idx_learning_events_user_char ON learning_events(user_id, char);
CREATE INDEX idx_learning_events_user_page ON learning_events(user_id, page_key);
CREATE INDEX idx_learning_events_user_session ON learning_events(user_id, session_id);

ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events" ON learning_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events" ON learning_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own events" ON learning_events
    FOR DELETE USING (auth.uid() = user_id);
