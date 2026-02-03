-- Add call_group column to inspections table
ALTER TABLE public.inspections
ADD COLUMN IF NOT EXISTS call_group TEXT;
