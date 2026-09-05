ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Web';
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_challenges_category ON public.challenges(category);
CREATE INDEX IF NOT EXISTS idx_challenges_tags ON public.challenges USING GIN(tags);
