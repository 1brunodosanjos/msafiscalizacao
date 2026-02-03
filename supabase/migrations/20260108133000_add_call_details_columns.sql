-- Add missing columns for Fiscalizacao Calls
ALTER TABLE public.inspections
ADD COLUMN IF NOT EXISTS participants_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS raised_hands_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS solved_problems_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_attendance_time TEXT;

-- Create constraint to ensure positive counts if needed (optional but good practice)
-- ALTER TABLE public.inspections ADD CONSTRAINT check_participants_positive CHECK (participants_count >= 0);
