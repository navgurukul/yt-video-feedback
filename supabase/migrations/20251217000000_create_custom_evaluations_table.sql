-- Create table for custom evaluations (other type)
CREATE TABLE public.tbl_ailabs_ytfeedback_custom_evaluations (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  video_url TEXT NOT NULL,
  custom_prompt TEXT NOT NULL,
  custom_context TEXT,
  overall_assessment TEXT,
  criteria_analysis TEXT,
  custom_feedback TEXT,
  evaluation_json TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security for the custom evaluations table
ALTER TABLE public.tbl_ailabs_ytfeedback_custom_evaluations ENABLE ROW LEVEL SECURITY;

-- Create policies for user access to custom evaluation table
CREATE POLICY "Users can view their own custom evaluations" 
ON public.tbl_ailabs_ytfeedback_custom_evaluations 
FOR SELECT 
USING (email = (SELECT auth.jwt() ->> 'email'));

CREATE POLICY "Users can create their own custom evaluations" 
ON public.tbl_ailabs_ytfeedback_custom_evaluations 
FOR INSERT 
WITH CHECK (email = (SELECT auth.jwt() ->> 'email'));

CREATE POLICY "Users can delete their own custom evaluations" 
ON public.tbl_ailabs_ytfeedback_custom_evaluations 
FOR DELETE 
USING (email = (SELECT auth.jwt() ->> 'email'));

-- Create indexes for better query performance
CREATE INDEX idx_custom_evaluation_email ON public.tbl_ailabs_ytfeedback_custom_evaluations(email);
CREATE INDEX idx_custom_evaluation_created_at ON public.tbl_ailabs_ytfeedback_custom_evaluations(created_at DESC);