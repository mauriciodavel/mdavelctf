ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS participant_legal_name TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS workload_hours NUMERIC(6,2) NOT NULL DEFAULT 0;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS event_start TIMESTAMPTZ;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS event_end TIMESTAMPTZ;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '[]'::jsonb;
