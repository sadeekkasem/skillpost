-- رفيق الحفظ (phase 1). Tables live in public with a hifz_ prefix so the
-- Data API can reach them without changing exposed-schema settings.
-- Do not apply this to the hosted project until the owner approves.

CREATE TYPE public.hifz_goal AS ENUM ('new', 'revise', 'wird');
CREATE TYPE public.hifz_amount_unit AS ENUM ('ayat', 'half_page', 'page');
CREATE TYPE public.hifz_segment_status AS ENUM ('not_started', 'learning', 'memorized');

CREATE TABLE public.hifz_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Europe/Helsinki',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hifz_profiles_timezone_len CHECK (char_length(timezone) BETWEEN 1 AND 64)
);

CREATE TABLE public.hifz_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal public.hifz_goal NOT NULL,
  amount_unit public.hifz_amount_unit NOT NULL,
  amount_value integer NOT NULL,
  start_surah smallint NOT NULL,
  start_ayah smallint NOT NULL,
  from_end boolean NOT NULL DEFAULT false,
  memorize_weekdays smallint[] NOT NULL DEFAULT '{}',
  revise_weekdays smallint[] NOT NULL DEFAULT '{}',
  rest_weekdays smallint[] NOT NULL DEFAULT '{}',
  timezone text NOT NULL DEFAULT 'Europe/Helsinki',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hifz_plans_amount_positive CHECK (amount_value > 0 AND amount_value <= 20),
  CONSTRAINT hifz_plans_start_surah CHECK (start_surah BETWEEN 1 AND 114),
  CONSTRAINT hifz_plans_start_ayah CHECK (start_ayah BETWEEN 1 AND 286),
  CONSTRAINT hifz_plans_timezone_len CHECK (char_length(timezone) BETWEEN 1 AND 64),
  CONSTRAINT hifz_plans_weekdays_iso CHECK (
    memorize_weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
    AND revise_weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
    AND rest_weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
  )
);

CREATE UNIQUE INDEX hifz_plans_one_active ON public.hifz_plans (user_id) WHERE is_active;
CREATE INDEX hifz_plans_user_id_idx ON public.hifz_plans (user_id);

CREATE TABLE public.hifz_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.hifz_plans(id) ON DELETE SET NULL,
  start_surah smallint NOT NULL,
  start_ayah smallint NOT NULL,
  end_surah smallint NOT NULL,
  end_ayah smallint NOT NULL,
  page_number smallint,
  juz_number smallint,
  status public.hifz_segment_status NOT NULL DEFAULT 'memorized',
  ease numeric(4,2) NOT NULL DEFAULT 2.50,
  interval_days integer NOT NULL DEFAULT 0,
  due_date date,
  last_reviewed_at timestamptz,
  lapses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hifz_segments_start CHECK (start_surah BETWEEN 1 AND 114 AND start_ayah BETWEEN 1 AND 286),
  CONSTRAINT hifz_segments_end CHECK (end_surah BETWEEN 1 AND 114 AND end_ayah BETWEEN 1 AND 286),
  CONSTRAINT hifz_segments_page CHECK (page_number IS NULL OR page_number BETWEEN 1 AND 604),
  CONSTRAINT hifz_segments_juz CHECK (juz_number IS NULL OR juz_number BETWEEN 1 AND 30),
  CONSTRAINT hifz_segments_ease CHECK (ease >= 1.30 AND ease <= 3.00),
  CONSTRAINT hifz_segments_interval CHECK (interval_days >= 0 AND interval_days <= 60),
  CONSTRAINT hifz_segments_lapses CHECK (lapses >= 0)
);

CREATE INDEX hifz_segments_user_due_idx ON public.hifz_segments (user_id, due_date);
CREATE INDEX hifz_segments_user_status_idx ON public.hifz_segments (user_id, status);

CREATE TABLE public.hifz_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  new_completed boolean NOT NULL DEFAULT false,
  postponed boolean NOT NULL DEFAULT false,
  is_rest_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hifz_daily_logs_unique UNIQUE (user_id, log_date)
);

CREATE INDEX hifz_daily_logs_user_date_idx ON public.hifz_daily_logs (user_id, log_date);

CREATE TABLE public.hifz_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hifz_streaks_current CHECK (current_streak >= 0),
  CONSTRAINT hifz_streaks_longest CHECK (longest_streak >= 0 AND longest_streak >= current_streak)
);

ALTER TABLE public.hifz_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hifz_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hifz_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hifz_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hifz_streaks ENABLE ROW LEVEL SECURITY;

-- (select auth.uid()) is evaluated once per statement, not per row.
CREATE POLICY hifz_profiles_owner ON public.hifz_profiles
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY hifz_plans_owner ON public.hifz_plans
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY hifz_segments_owner ON public.hifz_segments
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY hifz_daily_logs_owner ON public.hifz_daily_logs
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY hifz_streaks_owner ON public.hifz_streaks
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

REVOKE ALL ON TABLE public.hifz_profiles FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.hifz_plans FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.hifz_segments FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.hifz_daily_logs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.hifz_streaks FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hifz_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hifz_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hifz_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hifz_daily_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hifz_streaks TO authenticated;

GRANT ALL ON TABLE public.hifz_profiles TO service_role;
GRANT ALL ON TABLE public.hifz_plans TO service_role;
GRANT ALL ON TABLE public.hifz_segments TO service_role;
GRANT ALL ON TABLE public.hifz_daily_logs TO service_role;
GRANT ALL ON TABLE public.hifz_streaks TO service_role;
