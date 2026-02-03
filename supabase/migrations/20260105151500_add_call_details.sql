-- Add new columns for Call Inspection details
ALTER TABLE inspections 
ADD COLUMN IF NOT EXISTS participants_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS raised_hands_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS solved_problems_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_attendance_time TEXT; -- Using text to allow formats like '5 min' or '10:30'
