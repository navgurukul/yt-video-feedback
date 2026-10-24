-- Production dataset "v_ailabs_phasewise_student_project_explanation_analysis" (Superset physical dataset on the MAIN view), runs on MAIN.
-- columns: evaluated_at, email, phase_name, source, criteria, level, What you did well?, What could you do better?, Suggestion for improvement?
SELECT evaluated_at, email, phase_name, source, criteria, level, "What you did well?", "What could you do better?", "Suggestion for improvement?"
  FROM public.v_ailabs_phasewise_student_project_explanation_analysis
