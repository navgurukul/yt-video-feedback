CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tbl_failed_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  video_url TEXT NOT NULL,
  video_type TEXT NOT NULL,
  selected_phase TEXT,
  selected_video_title TEXT,
  video_details TEXT,
  promptbegining TEXT,
  rubric JSONB,
  structuredreturnedconfig JSONB,
  custom_prompt TEXT,
  custom_context TEXT,
  request_payload JSONB,
  error_type TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_requests_user_email
  ON public.tbl_failed_requests (user_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_failed_requests_user_id
  ON public.tbl_failed_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_failed_requests_video_type
  ON public.tbl_failed_requests (video_type);
