-- Drop the old unique constraint (without user_id)
ALTER TABLE confidence_scores DROP CONSTRAINT IF EXISTS confidence_scores_page_key_char_skill_key_key;

-- Create new unique constraint including user_id (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'confidence_scores_user_page_char_skill_key'
    ) THEN
        ALTER TABLE confidence_scores ADD CONSTRAINT confidence_scores_user_page_char_skill_key UNIQUE (user_id, page_key, char, skill_key);
    END IF;
END $$;
