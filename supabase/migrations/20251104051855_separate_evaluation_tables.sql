-- Drop existing table if it exists
DROP TABLE IF EXISTS public.tbl_ailabs_ytfeedback_video_evaluations;

-- Create table for project evaluations
CREATE TABLE public.tbl_ailabs_ytfeedback_project_evaluation (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  project_name VARCHAR(255),
  video_url TEXT NOT NULL,
  project_explanation_evaluation TEXT NULL,
  project_explanation_feedback TEXT NULL,
  project_explanation_evaluationjson TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create table for concept evaluations
CREATE TABLE public.tbl_ailabs_ytfeedback_concept_evaluations (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  project_name VARCHAR(255),
  page_name VARCHAR(255) NOT NULL,
  video_url TEXT NOT NULL,
  concept_explanation_accuracy INT,
  concept_explanation_feedback TEXT,
  ability_to_explain_evaluation TEXT NULL,
  ability_to_explain_feedback TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security for both tables
ALTER TABLE public.tbl_ailabs_ytfeedback_project_evaluation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_ailabs_ytfeedback_concept_evaluations ENABLE ROW LEVEL SECURITY;

-- Create policies for user access to project evaluation table
CREATE POLICY "Users can view their own project evaluations" 
ON public.tbl_ailabs_ytfeedback_project_evaluation 
FOR SELECT 
USING (email = (SELECT auth.jwt() ->> 'email'));

CREATE POLICY "Users can create their own project evaluations" 
ON public.tbl_ailabs_ytfeedback_project_evaluation 
FOR INSERT 
WITH CHECK (email = (SELECT auth.jwt() ->> 'email'));

CREATE POLICY "Users can delete their own project evaluations" 
ON public.tbl_ailabs_ytfeedback_project_evaluation 
FOR DELETE 
USING (email = (SELECT auth.jwt() ->> 'email'));

-- Create policies for user access to concept evaluation table
CREATE POLICY "Users can view their own concept evaluations" 
ON public.tbl_ailabs_ytfeedback_concept_evaluations 
FOR SELECT 
USING (email = (SELECT auth.jwt() ->> 'email'));

CREATE POLICY "Users can create their own concept evaluations" 
ON public.tbl_ailabs_ytfeedback_concept_evaluations 
FOR INSERT 
WITH CHECK (email = (SELECT auth.jwt() ->> 'email'));

CREATE POLICY "Users can delete their own concept evaluations" 
ON public.tbl_ailabs_ytfeedback_concept_evaluations 
FOR DELETE 
USING (email = (SELECT auth.jwt() ->> 'email'));

-- Create indexes for better query performance
CREATE INDEX idx_project_evaluation_email ON public.tbl_ailabs_ytfeedback_project_evaluation(email);
CREATE INDEX idx_project_evaluation_created_at ON public.tbl_ailabs_ytfeedback_project_evaluation(created_at DESC);

CREATE INDEX idx_concept_evaluation_email ON public.tbl_ailabs_ytfeedback_concept_evaluations(email);
CREATE INDEX idx_concept_evaluation_created_at ON public.tbl_ailabs_ytfeedback_concept_evaluations(created_at DESC);