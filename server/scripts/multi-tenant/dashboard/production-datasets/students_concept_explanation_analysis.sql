-- Production dataset "Students Concept Explanation Analysis" (Superset export 2026-10-24), runs on MAIN.
-- columns: email, phase_name, video_number, video_title, ability_to_explain_evaluation, ability_to_explain_did_well, ability_to_explain_could_be_better, ability_to_explain_suggestion, accuracy_above_80, concept_explanation_did_well, concept_explanation_could_be_better, concept_explanation_suggestion, evaluated_at
SELECT email, phase_name, video_number, video_title, ability_to_explain_evaluation, ability_to_explain_did_well, ability_to_explain_could_be_better, ability_to_explain_suggestion, accuracy_above_80, concept_explanation_did_well, concept_explanation_could_be_better, concept_explanation_suggestion, evaluated_at
	FROM public.v_ailabs_students_concept_explanationanalysis
