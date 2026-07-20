-- Create table for storing manual video evaluations
CREATE TABLE IF NOT EXISTS public.tbl_manual_video_evaluations (
  id SERIAL PRIMARY KEY,
  project_evaluation_id INTEGER NOT NULL,
  evaluator_email VARCHAR(255) NOT NULL,
  evaluated_video_url TEXT,
  project_name VARCHAR(255),
  phase VARCHAR(100),
  evaluation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  evaluation_json JSONB NOT NULL,
  overall_rating VARCHAR(50),
  overall_comments TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_project_evaluation 
    FOREIGN KEY (project_evaluation_id) 
    REFERENCES tbl_ailabs_ytfeedback_project_evaluation(id) 
    ON DELETE CASCADE
);

CREATE INDEX idx_manual_eval_project_id ON public.tbl_manual_video_evaluations(project_evaluation_id);
CREATE INDEX idx_manual_eval_evaluator ON public.tbl_manual_video_evaluations(evaluator_email);
CREATE INDEX idx_manual_eval_phase ON public.tbl_manual_video_evaluations(phase);
CREATE INDEX idx_manual_eval_date ON public.tbl_manual_video_evaluations(evaluation_date DESC);
CREATE INDEX idx_manual_eval_approved ON public.tbl_manual_video_evaluations(is_approved);

ALTER TABLE public.tbl_manual_video_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Evaluators can view all manual evaluations"
  ON public.tbl_manual_video_evaluations
  FOR SELECT
  USING (true);

CREATE POLICY "Evaluators can create manual evaluations"
  ON public.tbl_manual_video_evaluations
  FOR INSERT
  WITH CHECK (
    evaluator_email = (SELECT auth.jwt() ->> 'email')
  );

CREATE POLICY "Evaluators can update their own evaluations"
  ON public.tbl_manual_video_evaluations
  FOR UPDATE
  USING (evaluator_email = (SELECT auth.jwt() ->> 'email'))
  WITH CHECK (evaluator_email = (SELECT auth.jwt() ->> 'email'));

COMMENT ON TABLE public.tbl_manual_video_evaluations IS 'Stores manual/human evaluations of videos for quality assurance and verification purposes';
COMMENT ON COLUMN public.tbl_manual_video_evaluations.evaluation_json IS 'JSON structure containing parameter-wise feedback with what went well, improvements needed, and suggestions for each rubric parameter';
COMMENT ON COLUMN public.tbl_manual_video_evaluations.evaluator_email IS 'Email of the staff/evaluator who performed the manual evaluation';
COMMENT ON COLUMN public.tbl_manual_video_evaluations.is_approved IS 'Whether the manual evaluation has been reviewed and approved by a supervisor';
