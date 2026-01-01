-- Add `country` column to leads if missing
-- Safe migration: non-destructive, idempotent
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS country text DEFAULT '';

-- Optional: update existing rows without a country (unnecessary because of DEFAULT)
-- UPDATE public.leads SET country = '' WHERE country IS NULL;
