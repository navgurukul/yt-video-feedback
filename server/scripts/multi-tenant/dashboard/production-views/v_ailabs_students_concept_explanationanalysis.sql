-- production definition of public.v_ailabs_students_concept_explanationanalysis (read with pg_get_viewdef)
-- reads: tbl_ailabls_ytfeedback_phases, tbl_ailabls_ytfeedback_phasevideos, tbl_ailabs_ytfeedback_concept_evaluations
CREATE OR REPLACE VIEW public."v_ailabs_students_concept_explanationanalysis" AS
 SELECT email,
    phase_name,
    video_number,
    video_title,
    ability_to_explain_evaluation,
    ability_to_explain_did_well,
    ability_to_explain_could_be_better,
    ability_to_explain_suggestion,
    accuracy_above_80,
    concept_explanation_did_well,
    concept_explanation_could_be_better,
    concept_explanation_suggestion,
    evaluated_at
   FROM ( WITH all_emails AS (
                 SELECT DISTINCT lower(TRIM(BOTH FROM tbl_ailabs_ytfeedback_concept_evaluations.email)) AS email
                   FROM tbl_ailabs_ytfeedback_concept_evaluations
                  WHERE tbl_ailabs_ytfeedback_concept_evaluations.email IS NOT NULL AND TRIM(BOTH FROM tbl_ailabs_ytfeedback_concept_evaluations.email) <> ''::text
                ), phase_videos AS (
                 SELECT p.id AS phase_id,
                    p.phase_name,
                    pv.id AS video_id,
                    pv.video_title,
                    pv.video_type,
                    row_number() OVER (PARTITION BY pv.phase_id ORDER BY pv.id) AS video_number
                   FROM tbl_ailabls_ytfeedback_phasevideos pv
                     JOIN tbl_ailabls_ytfeedback_phases p ON p.id = pv.phase_id
                ), eval_ranked AS (
                 SELECT ae.email,
                    pv.phase_id,
                    pv.phase_name,
                    pv.video_id,
                    pv.video_number,
                    pv.video_title,
                    pv.video_type,
                    ce.ability_to_explain_evaluation,
                    ce.ability_to_explain_feedback,
                    ce.concept_explanation_accuracy,
                    ce.concept_explanation_feedback,
                    ce.created_at,
                    row_number() OVER (PARTITION BY ae.email, pv.video_id ORDER BY ce.created_at DESC) AS rn
                   FROM all_emails ae
                     CROSS JOIN phase_videos pv
                     LEFT JOIN tbl_ailabs_ytfeedback_concept_evaluations ce ON lower(TRIM(BOTH FROM ce.email)) = ae.email AND (lower(TRIM(BOTH FROM ce.page_name)) = lower(TRIM(BOTH FROM pv.video_title)) OR lower(TRIM(BOTH FROM ce.page_name)) = lower(TRIM(BOTH FROM (pv.video_title::text || ' - '::text) || pv.phase_name::text)) OR ce.project_name IS NOT NULL AND lower(TRIM(BOTH FROM ce.project_name)) = lower(TRIM(BOTH FROM pv.phase_name)) AND lower(TRIM(BOTH FROM ce.page_name)) = lower(TRIM(BOTH FROM pv.video_title)))
                ), latest_evals AS (
                 SELECT eval_ranked.email,
                    eval_ranked.phase_id,
                    eval_ranked.phase_name,
                    eval_ranked.video_id,
                    eval_ranked.video_number,
                    eval_ranked.video_title,
                    eval_ranked.video_type,
                    eval_ranked.ability_to_explain_evaluation,
                    eval_ranked.ability_to_explain_feedback,
                    eval_ranked.concept_explanation_accuracy,
                    eval_ranked.concept_explanation_feedback,
                    eval_ranked.created_at
                   FROM eval_ranked
                  WHERE eval_ranked.rn = 1 AND eval_ranked.created_at IS NOT NULL
                )
         SELECT latest_evals.email,
            latest_evals.phase_name,
            latest_evals.video_number,
            latest_evals.video_title,
            latest_evals.video_type,
            latest_evals.ability_to_explain_evaluation,
            latest_evals.ability_to_explain_feedback,
            NULLIF(replace(regexp_replace(regexp_replace(btrim(COALESCE((NULLIF(latest_evals.ability_to_explain_feedback, ''::text)::jsonb -> 'What you did well.'::text)::text, '[]'::text), '[]'::text), '^"|"$'::text, ''::text, 'g'::text), '","'::text, chr(10), 'g'::text), '\"'::text, '"'::text), ''::text) AS ability_to_explain_did_well,
            NULLIF(replace(regexp_replace(regexp_replace(btrim(COALESCE((NULLIF(latest_evals.ability_to_explain_feedback, ''::text)::jsonb -> 'What could you do better.'::text)::text, '[]'::text), '[]'::text), '^"|"$'::text, ''::text, 'g'::text), '","'::text, chr(10), 'g'::text), '\"'::text, '"'::text), ''::text) AS ability_to_explain_could_be_better,
            NULLIF(replace(regexp_replace(regexp_replace(btrim(COALESCE((NULLIF(latest_evals.ability_to_explain_feedback, ''::text)::jsonb -> 'Suggestion for improving explanation.'::text)::text, '[]'::text), '[]'::text), '^"|"$'::text, ''::text, 'g'::text), '","'::text, chr(10), 'g'::text), '\"'::text, '"'::text), ''::text) AS ability_to_explain_suggestion,
            latest_evals.concept_explanation_accuracy,
                CASE
                    WHEN NULLIF(regexp_replace(COALESCE(latest_evals.concept_explanation_accuracy, ''::text), '%'::text, ''::text, 'g'::text), ''::text)::numeric > 80::numeric THEN 'Yes'::text
                    ELSE 'No'::text
                END AS accuracy_above_80,
            latest_evals.concept_explanation_feedback,
            NULLIF(replace(regexp_replace(regexp_replace(btrim(COALESCE((NULLIF(latest_evals.concept_explanation_feedback, ''::text)::jsonb -> 'What you did well.'::text)::text, '[]'::text), '[]'::text), '^"|"$'::text, ''::text, 'g'::text), '","'::text, chr(10), 'g'::text), '\"'::text, '"'::text), ''::text) AS concept_explanation_did_well,
            NULLIF(replace(regexp_replace(regexp_replace(btrim(COALESCE((NULLIF(latest_evals.concept_explanation_feedback, ''::text)::jsonb -> 'What could you do better.'::text)::text, '[]'::text), '[]'::text), '^"|"$'::text, ''::text, 'g'::text), '","'::text, chr(10), 'g'::text), '\"'::text, '"'::text), ''::text) AS concept_explanation_could_be_better,
            NULLIF(replace(regexp_replace(regexp_replace(btrim(COALESCE((NULLIF(latest_evals.concept_explanation_feedback, ''::text)::jsonb -> 'Suggestion for technical accuracy improvement.'::text)::text, '[]'::text), '[]'::text), '^"|"$'::text, ''::text, 'g'::text), '","'::text, chr(10), 'g'::text), '\"'::text, '"'::text), ''::text) AS concept_explanation_suggestion,
            latest_evals.created_at AS evaluated_at
           FROM latest_evals
          ORDER BY latest_evals.email, latest_evals.phase_id, latest_evals.video_number) virtual_table
 LIMIT 1000;
