-- Add comment column to all three evaluation tables to store model selection information
-- Migration created: March 2, 2026

-- Add comment column to project evaluation table
ALTER TABLE public.tbl_ailabs_ytfeedback_project_evaluation
ADD COLUMN IF NOT EXISTS comment TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN public.tbl_ailabs_ytfeedback_project_evaluation.comment IS 'Stores the Gemini model used for evaluation (e.g., "Evaluated using Gemini 2.5 Flash" or "Evaluated using Gemini 3.0 Flash")';

-- Add comment column to concept evaluations table
ALTER TABLE public.tbl_ailabs_ytfeedback_concept_evaluations
ADD COLUMN IF NOT EXISTS comment TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN public.tbl_ailabs_ytfeedback_concept_evaluations.comment IS 'Stores the Gemini model used for evaluation (e.g., "Evaluated using Gemini 2.5 Flash" or "Evaluated using Gemini 3.0 Flash")';

-- Add comment column to custom evaluations table
ALTER TABLE public.tbl_ailabs_ytfeedback_custom_evaluations
ADD COLUMN IF NOT EXISTS comment TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN public.tbl_ailabs_ytfeedback_custom_evaluations.comment IS 'Stores the Gemini model used for evaluation (e.g., "Evaluated using Gemini 2.5 Flash" or "Evaluated using Gemini 3.0 Flash")';
