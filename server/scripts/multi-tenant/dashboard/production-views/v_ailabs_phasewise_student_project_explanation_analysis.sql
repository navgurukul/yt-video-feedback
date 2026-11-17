-- production definition of public.v_ailabs_phasewise_student_project_explanation_analysis (read with pg_get_viewdef)
-- reads: tbl_ailabls_ytfeedback_phases, tbl_ailabs_projectanalyzer_projects_af, tbl_ailabs_projectanalyzer_users_af, tbl_ailabs_ytfeedback_project_evaluation
CREATE OR REPLACE VIEW public."v_ailabs_phasewise_student_project_explanation_analysis" AS
 WITH latest_yt_eval AS (
         SELECT DISTINCT ON ((lower(TRIM(BOTH FROM pe.email))), ph.id) lower(TRIM(BOTH FROM pe.email)) AS email,
            ph.id AS phase_id,
            ph.phase_name,
            pe.created_at AS evaluated_at,
            pe.project_explanation_evaluationjson
           FROM tbl_ailabls_ytfeedback_phases ph
             JOIN tbl_ailabs_ytfeedback_project_evaluation pe ON lower(TRIM(BOTH FROM pe.project_name)) = lower(TRIM(BOTH FROM ph.phase_name))
          WHERE pe.project_explanation_evaluationjson IS NOT NULL AND TRIM(BOTH FROM pe.project_explanation_evaluationjson) <> ''::text
          ORDER BY (lower(TRIM(BOTH FROM pe.email))), ph.id, pe.created_at DESC
        ), latest_pa_eval AS (
         SELECT DISTINCT ON ((lower(TRIM(BOTH FROM pu.email))), pp.phase_num) lower(TRIM(BOTH FROM pu.email)) AS email,
            pp.phase_num AS phase_id,
            COALESCE(pp."updatedAt", pp."createdAt") AS evaluated_at,
            pp."finalFeedback"
           FROM ( SELECT pp_1._id,
                    pp_1."userId",
                    pp_1."studentName",
                    pp_1.files,
                    pp_1.analysis,
                    pp_1.context,
                    pp_1.phase,
                    pp_1."rubricContent",
                    pp_1."personalProjectData",
                    pp_1.status,
                    pp_1."userPhaseLevel",
                    pp_1."topicsToRevise",
                    pp_1."finalFeedback",
                    pp_1."createdAt",
                    pp_1."updatedAt",
                    pp_1.__v,
                    pp_1.full_document,
                    pp_1.inserted_at,
                    (regexp_match(pp_1.phase, '^phase([0-9]+)$'::text))[1]::integer AS phase_num
                   FROM tbl_ailabs_projectanalyzer_projects_af pp_1
                  WHERE lower(TRIM(BOTH FROM COALESCE(pp_1.status, ''::text))) = 'completed'::text AND pp_1."finalFeedback" IS NOT NULL AND pp_1.phase ~ '^phase[0-9]+$'::text) pp
             JOIN tbl_ailabs_projectanalyzer_users_af pu ON pu._id = pp."userId"
          ORDER BY (lower(TRIM(BOTH FROM pu.email))), pp.phase_num, (COALESCE(pp."updatedAt", pp."createdAt")) DESC NULLS LAST
        ), yt_params AS (
         SELECT lye.email,
            ph.id AS phase_id,
            ph.phase_name,
            lye.evaluated_at,
            param.value ->> 'name'::text AS criteria,
            param.value ->> 'level'::text AS level,
            param.value -> 'feedback'::text AS feedback_json
           FROM tbl_ailabls_ytfeedback_phases ph
             LEFT JOIN latest_yt_eval lye ON lye.phase_id = ph.id
             LEFT JOIN LATERAL jsonb_array_elements(COALESCE(lye.project_explanation_evaluationjson::jsonb -> 'parameters'::text, '[]'::jsonb)) param(value) ON true
        ), yt_feedback_extracted AS (
         SELECT yp.email,
            yp.phase_id,
            yp.phase_name,
            'YT Tool'::text AS source,
            yp.evaluated_at,
            yp.criteria,
            yp.level,
            ( SELECT string_agg(w.value, '
'::text) AS string_agg
                   FROM jsonb_array_elements_text(COALESCE(yp.feedback_json -> 'What you did well.'::text, '[]'::jsonb)) w(value)) AS did_well,
            ( SELECT string_agg(b.value, '
'::text) AS string_agg
                   FROM jsonb_array_elements_text(COALESCE(yp.feedback_json -> 'What could you do better.'::text, '[]'::jsonb)) b(value)) AS could_be_better,
            ( SELECT string_agg(s.value, '
'::text) AS string_agg
                   FROM jsonb_array_elements_text(COALESCE(yp.feedback_json -> 'Suggestion for project improvement.'::text, '[]'::jsonb)) s(value)) AS suggestions
           FROM yt_params yp
        ), pa_crits AS (
         SELECT lpe.email,
            ph.id AS phase_id,
            ph.phase_name,
            lpe.evaluated_at,
            crit.value ->> 'parameter'::text AS criteria,
            crit.value ->> 'assignedLevel'::text AS level,
            crit.value -> 'detailedFeedback'::text AS feedback_json
           FROM tbl_ailabls_ytfeedback_phases ph
             LEFT JOIN latest_pa_eval lpe ON lpe.phase_id = ph.id
             LEFT JOIN LATERAL jsonb_array_elements(COALESCE(lpe."finalFeedback" -> 'criterionWiseEvaluation'::text, '[]'::jsonb)) crit(value) ON true
          WHERE crit.value IS NOT NULL
        ), pa_feedback_extracted AS (
         SELECT pc.email,
            pc.phase_id,
            pc.phase_name,
            'Athena'::text AS source,
            pc.evaluated_at,
            pc.criteria,
            pc.level,
            ( SELECT string_agg(w.value, '
'::text) AS string_agg
                   FROM jsonb_array_elements_text(COALESCE(pc.feedback_json -> 'wellDone'::text, '[]'::jsonb)) w(value)) AS did_well,
            ( SELECT string_agg(b.value, '
'::text) AS string_agg
                   FROM jsonb_array_elements_text(COALESCE(pc.feedback_json -> 'couldBeBetter'::text, '[]'::jsonb)) b(value)) AS could_be_better,
            ( SELECT string_agg(s.value, '
'::text) AS string_agg
                   FROM jsonb_array_elements_text(COALESCE(pc.feedback_json -> 'suggestions'::text, '[]'::jsonb)) s(value)) AS suggestions
           FROM pa_crits pc
        ), all_feedback AS (
         SELECT yt_feedback_extracted.email,
            yt_feedback_extracted.phase_id,
            yt_feedback_extracted.phase_name,
            yt_feedback_extracted.source,
            yt_feedback_extracted.evaluated_at,
            yt_feedback_extracted.criteria,
            yt_feedback_extracted.level,
            yt_feedback_extracted.did_well,
            yt_feedback_extracted.could_be_better,
            yt_feedback_extracted.suggestions
           FROM yt_feedback_extracted
        UNION ALL
         SELECT pa_feedback_extracted.email,
            pa_feedback_extracted.phase_id,
            pa_feedback_extracted.phase_name,
            pa_feedback_extracted.source,
            pa_feedback_extracted.evaluated_at,
            pa_feedback_extracted.criteria,
            pa_feedback_extracted.level,
            pa_feedback_extracted.did_well,
            pa_feedback_extracted.could_be_better,
            pa_feedback_extracted.suggestions
           FROM pa_feedback_extracted
        )
 SELECT email,
    phase_name,
    source,
    evaluated_at,
    criteria,
    level,
    did_well AS "What you did well?",
    could_be_better AS "What could you do better?",
    suggestions AS "Suggestion for improvement?"
   FROM all_feedback
  ORDER BY email, phase_id, source, criteria;
