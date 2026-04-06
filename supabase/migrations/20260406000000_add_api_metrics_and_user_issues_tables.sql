-- Create table to track Gemini API call metrics
CREATE TABLE IF NOT EXISTS public.tbl_llm_api_calls (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER,
  user_email VARCHAR(255) NOT NULL,
  evaluation_type VARCHAR(50),
  video_type VARCHAR(50),
  video_url TEXT,
  api_call_number INTEGER,
  request_timestamp TIMESTAMP WITH TIME ZONE,
  api_latency_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  finish_reason VARCHAR(50),
  model_version VARCHAR(100),
  http_status INTEGER,
  error_message TEXT,
  raw_usage_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_llm_api_calls_user_email_created_at 
  ON public.tbl_llm_api_calls(user_email, created_at);

CREATE INDEX idx_llm_api_calls_evaluation_id 
  ON public.tbl_llm_api_calls(evaluation_id);

CREATE INDEX idx_llm_api_calls_http_status 
  ON public.tbl_llm_api_calls(http_status);

CREATE INDEX idx_llm_api_calls_created_at 
  ON public.tbl_llm_api_calls(created_at);

-- Create table to track user-reported issues
CREATE TABLE IF NOT EXISTS public.tbl_user_issues (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  evaluation_id INTEGER,
  api_call_id INTEGER,
  issue_type VARCHAR(100),
  issue_description TEXT,
  stacktrace TEXT,
  error_code VARCHAR(100),
  resolved BOOLEAN DEFAULT FALSE,
  user_feedback TEXT,
  resolution_notes TEXT,
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for user issues table
CREATE INDEX idx_user_issues_user_email_created_at 
  ON public.tbl_user_issues(user_email, created_at);

CREATE INDEX idx_user_issues_evaluation_id 
  ON public.tbl_user_issues(evaluation_id);

CREATE INDEX idx_user_issues_api_call_id 
  ON public.tbl_user_issues(api_call_id);

CREATE INDEX idx_user_issues_type_resolved 
  ON public.tbl_user_issues(issue_type, resolved);

CREATE INDEX idx_user_issues_created_at 
  ON public.tbl_user_issues(created_at);

-- Add comments for documentation
COMMENT ON TABLE public.tbl_llm_api_calls IS 'Stores Gemini API call metrics including latency, token usage, and response metadata';
COMMENT ON TABLE public.tbl_user_issues IS 'Tracks user-reported issues and errors encountered during video evaluations';

COMMENT ON COLUMN public.tbl_llm_api_calls.api_latency_ms IS 'End-to-end API response time in milliseconds';
COMMENT ON COLUMN public.tbl_llm_api_calls.prompt_tokens IS 'Number of tokens used in the input prompt';
COMMENT ON COLUMN public.tbl_llm_api_calls.completion_tokens IS 'Number of tokens generated in the response';
COMMENT ON COLUMN public.tbl_llm_api_calls.finish_reason IS 'Reason for stopping generation: STOP, MAX_TOKENS, SAFETY, OTHER, UNKNOWN';
COMMENT ON COLUMN public.tbl_llm_api_calls.raw_usage_metadata IS 'Full metadata object from Gemini API response (JSON)';

COMMENT ON COLUMN public.tbl_user_issues.issue_type IS 'Category of issue: video_error, api_error, parsing_error, network_error, other';
COMMENT ON COLUMN public.tbl_user_issues.resolved IS 'Whether the issue has been investigated and resolved';
COMMENT ON COLUMN public.tbl_user_issues.api_call_id IS 'Foreign key linking to tbl_llm_api_calls if applicable';
