-- Create tbl_ailabs_ytfeedback_video_evaluations table to store user feedback analyses
CREATE TABLE IF NOT EXISTS tbl_ailabs_ytfeedback_video_evaluations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  video_url TEXT NOT NULL,
  video_title TEXT NOT NULL,
  evaluation_data JSONB,
  video_details JSONB,
  evaluation_method VARCHAR(50),
  rubric_type VARCHAR(50),
  rubric JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tbl_ailabs_ytfeedback_video_evaluations_user_id ON tbl_ailabs_ytfeedback_video_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_tbl_ailabs_ytfeedback_video_evaluations_created_at ON tbl_ailabs_ytfeedback_video_evaluations(created_at DESC);