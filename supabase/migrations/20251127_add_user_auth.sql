-- Add user_id column for per-user data isolation
ALTER TABLE confidence_scores ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Create index for user lookups
CREATE INDEX idx_confidence_user_id ON confidence_scores(user_id);

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Allow all access" ON confidence_scores;

-- Create new RLS policies for user isolation
-- Users can only see their own data
CREATE POLICY "Users can view own data" ON confidence_scores
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own data
CREATE POLICY "Users can insert own data" ON confidence_scores
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON confidence_scores
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own data
CREATE POLICY "Users can delete own data" ON confidence_scores
    FOR DELETE USING (auth.uid() = user_id);
