-- 005_match_selected_day.sql
ALTER TABLE matches ADD COLUMN IF NOT EXISTS selected_day VARCHAR(20);
