-- =====================================================================================
-- Campus Learning Dashboard (Superset) — datasets for the multi-tenant architecture
--
-- Runs in the TEST database (test_ghar_central_db). Creates schema "dash" with one view
-- per Superset dataset, plus the shared building blocks they use. Re-runnable.
--
--   YT tool + Project Analyzer data : this database (public.*), Navgurukul rows only
--   Campus / students / attendance  : @src@.*  (MAIN, read only — see 10-main-ro-fdw.sql)
--   English speak / write grades    : @src@.*
--   Parameter weightages            : @src@.tbl_ailabs_phasewise_parameter_weightages
--
-- What changed compared with the production dashboard queries
--   * Phases come from the shared "phases" table (Navgurukul / School of Programming), phase
--     number = the "Phase N" in the name (sort order if a name has none). Evaluations are matched
--     through their phase_id / video_assignment_id links instead of by phase-name text, so
--     evaluations saved under OLD phase names now count (they were silently dropped before).
--     Rows without a link fall back to the old name matching.
--   * Project Analyzer projects are matched to phases through their phase spec, not "phaseN" text.
--   * Only Navgurukul rows are used: other institutions in the multi-tenant tools never leak in.
--   * The duplicated score logic of three datasets lives once, in dash.student_phase_scores.
-- =====================================================================================

SET client_min_messages = warning;

-- Rebuilt from scratch every run, so view definitions can change freely.
DROP SCHEMA IF EXISTS dash CASCADE;
CREATE SCHEMA dash;

-- ---------------------------------------------------------------- helpers ------------
-- Parameter-name normalisation used for matching rubric parameters to weightages.
CREATE OR REPLACE FUNCTION dash.norm(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(regexp_replace(lower(trim(coalesce(t, ''))), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- text → jsonb, NULL when the text is not JSON (old feedback rows can be plain text)
CREATE OR REPLACE FUNCTION dash.try_jsonb(t text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF t IS NULL OR btrim(t) = '' THEN RETURN NULL; END IF;
  RETURN t::jsonb;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

-- first of the given keys present in j, as display text (arrays become "• item" lines)
CREATE OR REPLACE FUNCTION dash.fb(j jsonb, VARIADIC keys text[]) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE jsonb_typeof(v)
           WHEN 'array'  THEN (SELECT string_agg('• ' || e, E'\n') FROM jsonb_array_elements_text(v) e)
           WHEN 'string' THEN v #>> '{}'
           ELSE v::text
         END
    FROM (SELECT (SELECT j -> k FROM unnest(keys) WITH ORDINALITY u(k, n)
                   WHERE jsonb_typeof(j) = 'object' AND j ? k ORDER BY n LIMIT 1) AS v) x
$$;

-- level name → points (1..4), as in the production queries
CREATE OR REPLACE FUNCTION dash.level_points(level text) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(trim(level)) WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2
                                 WHEN 'advanced' THEN 3 WHEN 'expert' THEN 4 END::numeric
$$;

-- ---------------------------------------------------------------- scope --------------
-- The dashboard is about Navgurukul's School of Programming. Edit here to reuse it elsewhere.
CREATE OR REPLACE VIEW dash.scope AS
SELECT i.id AS institution_id, p.id AS program_id
  FROM institutions i JOIN programs p ON p.institution_id = i.id
 WHERE i.slug = 'navgurukul' AND p.name = 'School of Programming';

-- Schools shown on the dashboard (same list as the production queries)
CREATE OR REPLACE VIEW dash.schools AS
SELECT * FROM (VALUES
  ('School of Programming'),
  ('Bachelor of Computer Applications- Eternal 24-27'),
  ('Bachelor of Computer Applications- Eternal 25-28'),
  ('Bachelor of Computer Applications- Eternal 26-29')
) AS s(school_name);

CREATE OR REPLACE VIEW dash.phases AS
SELECT ph.id AS phase_uuid,
       COALESCE((regexp_match(ph.name, '^\s*Phase\s+(\d+)', 'i'))[1]::int, ph.sort_order) AS phase_no,
       ph.name AS phase_name
  FROM phases ph JOIN dash.scope s ON s.program_id = ph.program_id
 WHERE ph.is_active;

-- concept videos, numbered within their phase (video_number as in the production dashboard)
CREATE OR REPLACE VIEW dash.concept_videos AS
SELECT va.id AS video_uuid, p.phase_uuid, p.phase_no, p.phase_name, va.title AS video_title,
       ROW_NUMBER() OVER (PARTITION BY va.phase_id ORDER BY va.sort_order, va.created_at, va.title) AS video_number
  FROM video_assignments va JOIN dash.phases p ON p.phase_uuid = va.phase_id
 WHERE va.video_type = 'concept' AND va.is_active;

-- ---------------------------------------------------------------- students (MAIN) ----
-- All School-of-Programming students with a Navgurukul email (4 statuses, like the
-- "Student Current Phase" dataset); the other datasets keep only Active / Intern (In Campus).
CREATE OR REPLACE VIEW dash.students AS
SELECT c."ID"::text                                                   AS campus_id,
       TRIM(c."Campus_Name")                                          AS campus_name,
       s."ID"::text                                                   AS student_id,
       LOWER(TRIM(s."Navgurukul_Email"))                              AS email,
       TRIM(CONCAT_WS(' ', s."Name.first_name", s."Name.last_name"))  AS student_name,
       s."Joining_Date"                                               AS joining_date,
       TRIM(s."Select_School1")                                       AS student_school,
       s."Status"                                                     AS student_status,
       s."Status" IN ('Active', 'Intern (In Campus)')                 AS in_campus
  FROM @src@.tbl_ghar_add_student s
  JOIN @src@.tbl_ghar_create_campus c ON c."ID"::text = s."Select_Campus"::text
 WHERE s."Status" IN ('Active', 'Intern (In Campus)', 'Intern (Out Campus)', 'InActive')
   AND TRIM(s."Select_School1") IN (SELECT school_name FROM dash.schools)
   AND s."Navgurukul_Email" IS NOT NULL AND TRIM(s."Navgurukul_Email") <> '';

CREATE OR REPLACE VIEW dash.eligible_students AS
SELECT campus_id, campus_name, student_id, email, student_name, joining_date, student_school, student_status
  FROM dash.students WHERE in_campus;

-- ---------------------------------------------------------------- tool data (TEST) ---
-- YT project-explanation evaluations, with their phase
CREATE OR REPLACE VIEW dash.yt_project_evals AS
SELECT e.id, LOWER(TRIM(e.email)) AS email, p.phase_no, p.phase_name, e.created_at,
       e.project_explanation_evaluationjson AS evaluation_json,
       (e.project_explanation_evaluationjson IS NOT NULL AND TRIM(e.project_explanation_evaluationjson) <> '') AS has_evaluation
  FROM tbl_ailabs_ytfeedback_project_evaluation e
  JOIN dash.scope sc ON sc.institution_id = e.institution_id
  LEFT JOIN legacy_phase_name_map m ON e.phase_id IS NULL AND m.old_name = e.project_name
  JOIN dash.phases p ON p.phase_uuid = COALESCE(e.phase_id, m.phase_id)
                     OR (e.phase_id IS NULL AND m.phase_id IS NULL AND LOWER(TRIM(p.phase_name)) = LOWER(TRIM(e.project_name)));

-- YT concept-explanation evaluations, with their phase and video
CREATE OR REPLACE VIEW dash.yt_concept_evals AS
SELECT ce.id, LOWER(TRIM(ce.email)) AS email, v.phase_no, v.phase_name, v.video_uuid, v.video_number, v.video_title,
       NULLIF(REGEXP_REPLACE(COALESCE(ce.concept_explanation_accuracy::text, ''), '[^0-9.]', '', 'g'), '')::numeric AS accuracy,
       ce.ability_to_explain_evaluation, ce.ability_to_explain_feedback, ce.concept_explanation_feedback, ce.created_at
  FROM tbl_ailabs_ytfeedback_concept_evaluations ce
  JOIN dash.scope sc ON sc.institution_id = ce.institution_id
  -- rows saved before the links existed: same title matching as the production queries
  LEFT JOIN LATERAL (
    SELECT cv.video_uuid FROM dash.concept_videos cv
     WHERE ce.video_assignment_id IS NULL
       AND (LOWER(TRIM(ce.page_name)) = LOWER(TRIM(cv.video_title))
            OR LOWER(TRIM(ce.page_name)) = LOWER(TRIM(cv.video_title || ' - ' || cv.phase_name)))
     ORDER BY (LOWER(TRIM(cv.phase_name)) = LOWER(TRIM(ce.project_name))) DESC, cv.phase_no
     LIMIT 1) fb ON TRUE
  JOIN dash.concept_videos v ON v.video_uuid = COALESCE(ce.video_assignment_id, fb.video_uuid);

-- Project Analyzer projects, with the student's email and the phase
CREATE OR REPLACE VIEW dash.pa_projects AS
SELECT pp."_id" AS project_id, LOWER(TRIM(pu.email)) AS email, p.phase_no, p.phase_name,
       LOWER(TRIM(COALESCE(pp.status, ''))) AS status,
       pp."finalFeedback"::jsonb AS final_feedback,
       (COALESCE(pp."updatedAt", pp."createdAt") AT TIME ZONE 'UTC') AS evaluated_at   -- *_af timestamps are UTC
  FROM tbl_ailabs_projectanalyzer_projects_af pp
  JOIN dash.scope sc ON sc.institution_id = pp.institution_id
  JOIN tbl_ailabs_projectanalyzer_users_af pu ON pu."_id" = pp."userId"
  LEFT JOIN pa_phase_specs ps ON ps.id = pp.pa_phase_spec_id
  JOIN dash.phases p ON p.phase_uuid = ps.phase_id
                     OR (ps.id IS NULL AND pp.phase ~ '^phase[0-9]+$'
                         AND p.phase_no = (regexp_match(pp.phase, '^phase([0-9]+)$'))[1]::int);

-- ---------------------------------------------------------------- scores -------------
CREATE OR REPLACE VIEW dash.weightages AS
SELECT (regexp_match(phaseid::text, '(\d+)'))[1]::int AS phase_no,
       dash.norm(parametername)                               AS norm_fullname,
       dash.norm(COALESCE(shortparametername, parametername)) AS norm_shortname,
       condensedweightage
  FROM @src@.tbl_ailabs_phasewise_parameter_weightages
 WHERE condensedweightage IS NOT NULL;

-- latest YT project evaluation with a result, per student and phase
CREATE OR REPLACE VIEW dash.latest_yt_project_eval AS
SELECT DISTINCT ON (email, phase_no) email, phase_no, phase_name, created_at AS evaluated_at, evaluation_json
  FROM dash.yt_project_evals WHERE has_evaluation
 ORDER BY email, phase_no, created_at DESC;

-- latest completed Project Analyzer evaluation, per student and phase
CREATE OR REPLACE VIEW dash.latest_pa_eval AS
SELECT DISTINCT ON (email, phase_no) email, phase_no, phase_name, evaluated_at, final_feedback
  FROM dash.pa_projects WHERE status = 'completed' AND final_feedback IS NOT NULL
 ORDER BY email, phase_no, evaluated_at DESC NULLS LAST;

-- every rubric parameter of every evaluation (both tools), with level and feedback
CREATE OR REPLACE VIEW dash.parameter_levels AS
SELECT 'YT Project Explanation'::text AS source, e.id::text AS evaluation_id, e.email, e.phase_no, e.phase_name,
       e.created_at AS evaluated_at, prm.value ->> 'name' AS criteria, prm.value ->> 'level' AS level,
       dash.fb(prm.value -> 'feedback', 'What you did well.', 'What you did well?', 'What could you do well?', 'good') AS did_well,
       dash.fb(prm.value -> 'feedback', 'What could you do better.', 'What could you do better?', 'improve') AS could_be_better,
       dash.fb(prm.value -> 'feedback', 'Suggestion for project improvement.', 'Suggestion for improvement?', 'Suggestion for improvement.', 'suggestion') AS suggestion
  FROM dash.yt_project_evals e
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(dash.try_jsonb(e.evaluation_json) -> 'parameters') = 'array'
         THEN dash.try_jsonb(e.evaluation_json) -> 'parameters' ELSE '[]'::jsonb END) prm
 WHERE e.has_evaluation
UNION ALL
SELECT 'Project Analyzer', p.project_id, p.email, p.phase_no, p.phase_name, p.evaluated_at,
       c.value ->> 'parameter', c.value ->> 'assignedLevel',
       dash.fb(c.value -> 'detailedFeedback', 'wellDone'),
       dash.fb(c.value -> 'detailedFeedback', 'couldBeBetter'),
       dash.fb(c.value -> 'detailedFeedback', 'suggestions')
  FROM dash.pa_projects p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.final_feedback -> 'criterionWiseEvaluation') = 'array'
         THEN p.final_feedback -> 'criterionWiseEvaluation' ELSE '[]'::jsonb END) c
 WHERE p.status = 'completed';

-- weighted score of one student's latest evaluation in a phase, per tool, summed over tools
-- (same formula as production: level/4 × condensed weightage, best-matching parameter name)
CREATE OR REPLACE VIEW dash.student_phase_scores AS
WITH wt AS MATERIALIZED (SELECT * FROM dash.weightages),   -- one remote read, not one per parameter
params AS (
  SELECT 'yt' AS src, l.email, l.phase_no, prm.value ->> 'name' AS param, prm.value ->> 'level' AS level
    FROM dash.latest_yt_project_eval l
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(dash.try_jsonb(l.evaluation_json) -> 'parameters') = 'array'
           THEN dash.try_jsonb(l.evaluation_json) -> 'parameters' ELSE '[]'::jsonb END) prm
  UNION ALL
  SELECT 'pa', l.email, l.phase_no, c.value ->> 'parameter', c.value ->> 'assignedLevel'
    FROM dash.latest_pa_eval l
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(l.final_feedback -> 'criterionWiseEvaluation') = 'array'
           THEN l.final_feedback -> 'criterionWiseEvaluation' ELSE '[]'::jsonb END) c
), scored AS (
  SELECT p.src, p.email, p.phase_no,
         ROUND(SUM(ROUND((dash.level_points(p.level) / 4) * w.condensedweightage, 2)), 2) AS score
    FROM params p
    JOIN LATERAL (
      SELECT w.condensedweightage FROM wt w
       WHERE w.phase_no = p.phase_no
         AND (w.norm_fullname = dash.norm(p.param) OR w.norm_shortname = dash.norm(p.param)
              OR dash.norm(p.param) LIKE '%' || w.norm_fullname || '%' OR w.norm_fullname LIKE '%' || dash.norm(p.param) || '%'
              OR dash.norm(p.param) LIKE '%' || w.norm_shortname || '%' OR w.norm_shortname LIKE '%' || dash.norm(p.param) || '%')
       ORDER BY (w.norm_fullname = dash.norm(p.param))::int DESC, (w.norm_shortname = dash.norm(p.param))::int DESC
       LIMIT 1) w ON TRUE
   WHERE dash.level_points(p.level) IS NOT NULL
   GROUP BY p.src, p.email, p.phase_no
)
SELECT email, phase_no, ROUND(SUM(score), 2) AS phase_score
  FROM scored GROUP BY email, phase_no;

-- first / last submission per student and phase (YT project video or completed PA project)
CREATE OR REPLACE VIEW dash.phase_submissions AS
SELECT email, phase_no, MIN(at) AS first_submission, MAX(at) AS last_submission,
       bool_or(src = 'yt') AS via_yt, bool_or(src = 'pa') AS via_pa
  FROM (SELECT email, phase_no, created_at AS at, 'yt' AS src FROM dash.yt_project_evals
        UNION ALL
        SELECT email, phase_no, evaluated_at, 'pa' FROM dash.pa_projects WHERE status = 'completed') x
 GROUP BY email, phase_no;

-- =====================================================================================
-- Datasets (one view per Superset dataset; column names = production dataset columns)
-- =====================================================================================

-- "Campus Phase Progress": students per current phase, per campus + school, with English grades.
-- Current phase = (highest phase with a YT project video or ANY Project Analyzer project) + 1, max 7.
CREATE OR REPLACE VIEW dash.campus_phase_progress AS
WITH any_submission AS (       -- production counts PA projects of any status here
  SELECT email, phase_no FROM dash.yt_project_evals
  UNION ALL SELECT email, phase_no FROM dash.pa_projects
), latest AS (
  SELECT es.campus_id, es.email, es.student_school,
         CASE WHEN mp.max_phase IS NULL THEN 1 WHEN mp.max_phase >= 7 THEN 7 ELSE mp.max_phase + 1 END AS phase_no
    FROM dash.eligible_students es
    LEFT JOIN (SELECT email, MAX(phase_no) AS max_phase FROM any_submission GROUP BY email) mp ON mp.email = es.email
), campus_schools AS (
  SELECT DISTINCT a."Campuses"::text AS campus_id, TRIM(a."Schools_Name") AS school_name
    FROM @src@.tbl_ghar_assign_school_to_campus a
   WHERE TRIM(a."Schools_Name") IN (SELECT school_name FROM dash.schools)
), totals AS (
  SELECT es.campus_id, es.campus_name, cs.school_name, COUNT(DISTINCT es.email) AS total_students
    FROM dash.eligible_students es
    JOIN campus_schools cs ON cs.campus_id = es.campus_id AND LOWER(cs.school_name) = LOWER(es.student_school)
   GROUP BY 1, 2, 3
), phase_counts AS (
  SELECT l.campus_id, cs.school_name, l.phase_no, COUNT(DISTINCT l.email) AS n
    FROM latest l JOIN campus_schools cs ON cs.campus_id = l.campus_id AND LOWER(cs.school_name) = LOWER(l.student_school)
   GROUP BY 1, 2, 3
), grades AS (
  SELECT 'write' AS kind, g.* FROM (SELECT DISTINCT ON ("Name") "Name"::text AS student_id, "Grade" AS grade
                                      FROM @src@."tbl_ghar_Write_Improve_Data" ORDER BY "Name", "Completion_Date" DESC NULLS LAST) g
  UNION ALL
  SELECT 'speak', g.* FROM (SELECT DISTINCT ON ("Name") "Name"::text AS student_id, "Grade" AS grade
                              FROM @src@."tbl_ghar_Speak_Improve_Data" ORDER BY "Name", "Completion_Date" DESC NULLS LAST) g
), grade_avg AS (
  SELECT es.campus_id, cs.school_name, g.kind,
         ROUND(AVG(CASE g.grade WHEN 'Absent in Exam' THEN 0 WHEN '-A1' THEN 1 WHEN 'A1' THEN 2 WHEN 'A2' THEN 3
                                WHEN 'B1' THEN 4 WHEN 'B2' THEN 5 WHEN 'C1' THEN 6 WHEN 'C2' THEN 7 END)) AS avg_num
    FROM dash.eligible_students es
    JOIN campus_schools cs ON cs.campus_id = es.campus_id AND LOWER(cs.school_name) = LOWER(es.student_school)
    JOIN grades g ON g.student_id = es.student_id
   WHERE g.grade IS NOT NULL
   GROUP BY 1, 2, 3
), grade_label AS (
  SELECT campus_id, school_name, kind,
         CASE avg_num WHEN 0 THEN 'Absent in Exam' WHEN 1 THEN '-A1' WHEN 2 THEN 'A1' WHEN 3 THEN 'A2'
                      WHEN 4 THEN 'B1' WHEN 5 THEN 'B2' WHEN 6 THEN 'C1' WHEN 7 THEN 'C2' END AS label
    FROM grade_avg
)
SELECT t.campus_name, t.school_name, t.total_students,
       MAX(gw.label) AS avg_write_grade, MAX(gs.label) AS avg_speak_grade,
       COALESCE(MAX(pc.n) FILTER (WHERE pc.phase_no = 1), 0) AS phase1,
       COALESCE(MAX(pc.n) FILTER (WHERE pc.phase_no = 2), 0) AS phase2,
       COALESCE(MAX(pc.n) FILTER (WHERE pc.phase_no = 3), 0) AS phase3,
       COALESCE(MAX(pc.n) FILTER (WHERE pc.phase_no = 4), 0) AS phase4,
       COALESCE(MAX(pc.n) FILTER (WHERE pc.phase_no = 5), 0) AS phase5,
       COALESCE(MAX(pc.n) FILTER (WHERE pc.phase_no = 6), 0) AS phase6,
       COALESCE(MAX(pc.n) FILTER (WHERE pc.phase_no = 7), 0) AS phase7
  FROM totals t
  LEFT JOIN phase_counts pc ON pc.campus_id = t.campus_id AND pc.school_name = t.school_name
  LEFT JOIN grade_label gw ON gw.campus_id = t.campus_id AND gw.school_name = t.school_name AND gw.kind = 'write'
  LEFT JOIN grade_label gs ON gs.campus_id = t.campus_id AND gs.school_name = t.school_name AND gs.kind = 'speak'
 GROUP BY t.campus_id, t.campus_name, t.school_name, t.total_students
 ORDER BY t.campus_name, t.school_name;

-- "Campus Phase Timeline & Score": per campus / school / phase — students who reached it,
-- average days from the previous phase's first submission, average phase score.
CREATE OR REPLACE VIEW dash.campus_phase_timeline_score AS
WITH firsts AS (
  SELECT es.campus_id, es.campus_name, es.email, es.student_school, s.phase_no, s.first_submission
    FROM dash.eligible_students es JOIN dash.phase_submissions s ON s.email = es.email
), gaps AS (
  SELECT f.*, CASE WHEN f.phase_no = 1 THEN 1
                   WHEN prev.first_submission IS NULL THEN NULL
                   ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM f.first_submission - prev.first_submission) / 86400)) END AS days_taken
    FROM firsts f LEFT JOIN firsts prev ON prev.email = f.email AND prev.phase_no = f.phase_no - 1   -- as production: by email
), scores AS (
  SELECT es.campus_id, es.student_school, sps.phase_no, ROUND(AVG(sps.phase_score), 2) AS avg_score
    FROM dash.eligible_students es JOIN dash.student_phase_scores sps ON sps.email = es.email
   GROUP BY 1, 2, 3
)
SELECT g.campus_name, g.student_school AS school_name, g.phase_no,
       CONCAT('Phase ', g.phase_no) AS phase_name,
       COUNT(DISTINCT g.email) AS student_count,
       ROUND(AVG(g.days_taken), 1) AS avg_time_days,
       MAX(sc.avg_score) AS avg_score
  FROM gaps g
  LEFT JOIN scores sc ON sc.campus_id = g.campus_id AND sc.student_school = g.student_school AND sc.phase_no = g.phase_no
 GROUP BY g.campus_id, g.campus_name, g.student_school, g.phase_no
 ORDER BY g.campus_name, g.student_school, g.phase_no;

-- "Phase Submission Student Details": first submission per student and phase.
CREATE OR REPLACE VIEW dash.phase_submission_student_details AS
SELECT es.campus_name, es.student_school AS school_name, es.student_name, es.email,
       s.phase_no, CONCAT('Phase ', s.phase_no) AS phase_name, s.first_submission
  FROM dash.eligible_students es JOIN dash.phase_submissions s ON s.email = es.email
 ORDER BY es.campus_name, es.student_school, s.phase_no, es.email;

-- "Student Missing Phase Submission Details": every student × phase with no submission.
CREATE OR REPLACE VIEW dash.student_missing_phase_submissions AS
WITH maxp AS (SELECT email, MAX(phase_no) AS max_submitted_phase FROM dash.phase_submissions GROUP BY email)
SELECT es.campus_name, es.student_school AS school_name, es.student_name, es.email,
       ph.phase_no AS phase_id, CONCAT('Phase ', ph.phase_no) AS phase_name, ph.phase_name AS full_phase_name,
       m.max_submitted_phase AS last_submitted_phase,
       CASE WHEN m.max_submitted_phase IS NULL THEN 'Not started'
            WHEN ph.phase_no < m.max_submitted_phase THEN 'Skipped (gap)'
            ELSE 'Pending' END AS missing_type
  FROM dash.eligible_students es
  CROSS JOIN dash.phases ph
  LEFT JOIN dash.phase_submissions s ON s.email = es.email AND s.phase_no = ph.phase_no
  LEFT JOIN maxp m ON m.email = es.email
 WHERE s.email IS NULL
 ORDER BY es.campus_name, es.student_school, ph.phase_no, es.email;

-- "Student Current Phase and Phase Scores": one row per student (4 statuses).
CREATE OR REPLACE VIEW dash.student_current_phase_scores AS
WITH submitted AS (           -- production: YT videos with a result, completed PA projects
  SELECT email, MAX(phase_no) AS last_phase FROM (
    SELECT email, phase_no FROM dash.yt_project_evals WHERE has_evaluation
    UNION ALL SELECT email, phase_no FROM dash.pa_projects WHERE status = 'completed') x
  GROUP BY email
), grade AS (
  SELECT 'write' AS kind, g.* FROM (SELECT DISTINCT ON ("Name") "Name"::text AS student_id, "Grade" AS grade
                                      FROM @src@."tbl_ghar_Write_Improve_Data" ORDER BY "Name", "Completion_Date" DESC NULLS LAST) g
  UNION ALL
  SELECT 'speak', g.* FROM (SELECT DISTINCT ON ("Name") "Name"::text AS student_id, "Grade" AS grade
                              FROM @src@."tbl_ghar_Speak_Improve_Data" ORDER BY "Name", "Completion_Date" DESC NULLS LAST) g
), leaves AS (
  SELECT LOWER(TRIM(s."Navgurukul_Email")) AS email,
         SUM(COALESCE(NULLIF(TRIM(al."Days"::text), '')::numeric, 0)) AS leave_days
    FROM @src@.tbl_ghar_apply_leave al
    JOIN @src@.tbl_ghar_add_student s ON al."Student1" = s."ID"::text
    JOIN @src@.tbl_ghar_leave_type lt ON al."Leave_Type" = lt."ID"::text
   WHERE s."Navgurukul_Email" IS NOT NULL AND TRIM(s."Navgurukul_Email") <> '' AND al."Leave_status" IS NOT NULL
   GROUP BY 1
), base AS (
  SELECT st.*, sub.last_phase,
         CASE WHEN st.joining_date IS NOT NULL THEN CURRENT_DATE - st.joining_date END AS time_on_campus_days,
         CASE WHEN st.joining_date IS NOT NULL
              THEN GREATEST(((CURRENT_DATE - st.joining_date) - COALESCE(l.leave_days, 0))::int, 0) ELSE 0 END AS total_present_days
    FROM dash.students st
    LEFT JOIN submitted sub ON sub.email = st.email
    LEFT JOIN leaves l ON l.email = st.email
)
SELECT b.campus_name, b.student_school AS school_name, b.student_name, b.email, b.student_status, b.joining_date,
       b.time_on_campus_days, b.total_present_days,
       gw.grade AS write_grade, gs.grade AS speak_grade,
       CASE WHEN b.last_phase IS NULL THEN 'Phase 1' WHEN b.last_phase >= 7 THEN 'Phase 7'
            ELSE CONCAT('Phase ', b.last_phase + 1) END AS current_phase,
       CASE WHEN b.total_present_days BETWEEN 0 AND 30 THEN 'Induction'
            WHEN b.total_present_days BETWEEN 31 AND 35 THEN 'Phase 1'
            WHEN b.total_present_days BETWEEN 36 AND 48 THEN 'Phase 2'
            WHEN b.total_present_days BETWEEN 49 AND 78 THEN 'Converting Flowcharts to JS'
            WHEN b.total_present_days BETWEEN 79 AND 108 THEN 'Phase 2.5'
            WHEN b.total_present_days BETWEEN 109 AND 128 THEN 'Phase 3'
            WHEN b.total_present_days BETWEEN 129 AND 142 THEN 'Phase 4'
            WHEN b.total_present_days BETWEEN 143 AND 157 THEN 'Phase 5'
            WHEN b.total_present_days BETWEEN 158 AND 167 THEN 'Phase 6'
            WHEN b.total_present_days BETWEEN 168 AND 212 THEN 'React'
            WHEN b.total_present_days BETWEEN 213 AND 242 THEN 'Phase 7 Final Open-ended Project'
            WHEN b.total_present_days BETWEEN 243 AND 422 THEN 'Milestone 2'
            WHEN b.total_present_days BETWEEN 423 AND 512 THEN 'Milestone 3'
            WHEN b.total_present_days BETWEEN 513 AND 602 THEN 'Milestone 4'
            ELSE 'Milestone 4++' END AS expected_phase,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 1) AS phase1_score,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 2) AS phase2_score,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 3) AS phase3_score,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 4) AS phase4_score,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 5) AS phase5_score,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 6) AS phase6_score,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 7) AS phase7_score
  FROM base b
  LEFT JOIN grade gw ON gw.student_id = b.student_id AND gw.kind = 'write'
  LEFT JOIN grade gs ON gs.student_id = b.student_id AND gs.kind = 'speak'
  LEFT JOIN dash.student_phase_scores sps ON sps.email = b.email
 GROUP BY b.campus_id, b.campus_name, b.student_school, b.student_name, b.email, b.student_status, b.joining_date,
          b.time_on_campus_days, b.total_present_days, b.last_phase, gw.grade, gs.grade
 ORDER BY b.campus_name, b.student_name, b.email;

-- "Concept Explanation Summary View": per student (who evaluated any concept video) and phase.
CREATE OR REPLACE VIEW dash.concept_explanation_summary AS
WITH latest AS (
  SELECT DISTINCT ON (email, video_uuid) email, phase_no, video_uuid, accuracy, ability_to_explain_evaluation, created_at
    FROM dash.yt_concept_evals ORDER BY email, video_uuid, created_at DESC
), metrics AS (
  SELECT s.email, p.phase_no, p.phase_name,
         COUNT(l.video_uuid) AS evaluated_videos,
         COUNT(*) FILTER (WHERE l.accuracy > 80) AS videos_cleared,
         (SELECT l2.ability_to_explain_evaluation FROM latest l2
           WHERE l2.email = s.email AND l2.phase_no = p.phase_no ORDER BY l2.created_at DESC LIMIT 1) AS last_level
    FROM (SELECT DISTINCT email FROM latest) s
    CROSS JOIN dash.phases p
    LEFT JOIN latest l ON l.email = s.email AND l.phase_no = p.phase_no
   GROUP BY s.email, p.phase_no, p.phase_name
)
SELECT email, phase_name, phase_no,
       CASE WHEN evaluated_videos = 0 THEN '-' ELSE videos_cleared::text END AS videos_cleared,
       CASE WHEN evaluated_videos = 0 THEN '-' ELSE ROUND(videos_cleared::numeric * 100 / evaluated_videos)::text || '%' END AS video_cleared_accuracy,
       COALESCE(last_level, '—') AS last_ability_to_explain_level
  FROM metrics
 ORDER BY email, phase_no;

-- "Students Concept Explanation Analysis" (was view v_ailabs_students_concept_explanationanalysis):
-- every concept-video evaluation with its feedback split into columns (plain-text feedback
-- of older rows is shown whole in the *_did_well columns).
CREATE OR REPLACE VIEW dash.students_concept_explanation_analysis AS
SELECT c.email, c.phase_name, c.video_number, c.video_title,
       c.ability_to_explain_evaluation,
       COALESCE(dash.fb(dash.try_jsonb(c.ability_to_explain_feedback), 'What you did well.', 'What you did well?'),
                CASE WHEN dash.try_jsonb(c.ability_to_explain_feedback) IS NULL THEN c.ability_to_explain_feedback END) AS ability_to_explain_did_well,
       dash.fb(dash.try_jsonb(c.ability_to_explain_feedback), 'What could you do better.', 'What could you do better?')       AS ability_to_explain_could_be_better,
       dash.fb(dash.try_jsonb(c.ability_to_explain_feedback), 'Suggestion for improving explanation.', 'Suggestion for improvement.') AS ability_to_explain_suggestion,
       CASE WHEN c.accuracy IS NULL THEN NULL WHEN c.accuracy > 80 THEN 'Yes' ELSE 'No' END                                    AS accuracy_above_80,
       c.accuracy                                                                                                              AS concept_explanation_accuracy,
       COALESCE(dash.fb(dash.try_jsonb(c.concept_explanation_feedback), 'What you did well.', 'What you did well?'),
                CASE WHEN dash.try_jsonb(c.concept_explanation_feedback) IS NULL THEN c.concept_explanation_feedback END) AS concept_explanation_did_well,
       dash.fb(dash.try_jsonb(c.concept_explanation_feedback), 'What could you do better.', 'What could you do better?')     AS concept_explanation_could_be_better,
       dash.fb(dash.try_jsonb(c.concept_explanation_feedback), 'Suggestion for technical accuracy improvement.', 'Suggestion for improvement.') AS concept_explanation_suggestion,
       c.created_at AS evaluated_at
  FROM dash.yt_concept_evals c;

-- "Phasewise Student Project Explanation Analysis" (was view
-- v_ailabs_phasewise_student_project_explanation_analysis): every rubric parameter of every
-- YT project-explanation and Project Analyzer evaluation, with level and feedback.
CREATE OR REPLACE VIEW dash.phasewise_project_explanation_analysis AS
SELECT email, phase_name, source, criteria, level,
       did_well        AS "What you did well?",
       could_be_better AS "What could you do better?",
       suggestion      AS "Suggestion for improvement?",
       evaluated_at
  FROM dash.parameter_levels;

-- "Weekly Campus Wise Summary": learning activities per campus per week.
CREATE OR REPLACE VIEW dash.weekly_campus_summary AS
WITH counts AS (
  SELECT campus_id, campus_name, COUNT(DISTINCT email) AS active_students FROM dash.eligible_students GROUP BY 1, 2
), activity AS (
  SELECT es.campus_id, es.campus_name, DATE_TRUNC('week', y.created_at)::date AS week, 'yt_project' AS src
    FROM dash.eligible_students es JOIN dash.yt_project_evals y ON y.email = es.email WHERE y.has_evaluation
  UNION ALL
  SELECT es.campus_id, es.campus_name, DATE_TRUNC('week', p.evaluated_at)::date, 'pa_project'
    FROM dash.eligible_students es JOIN dash.pa_projects p ON p.email = es.email
   WHERE p.status = 'completed' AND p.final_feedback IS NOT NULL
  UNION ALL
  SELECT es.campus_id, es.campus_name, DATE_TRUNC('week', ce.created_at)::date, 'yt_concept'
    FROM dash.eligible_students es
    JOIN tbl_ailabs_ytfeedback_concept_evaluations ce ON LOWER(TRIM(ce.email)) = es.email
    JOIN dash.scope sc ON sc.institution_id = ce.institution_id
   WHERE ce.ability_to_explain_evaluation IS NOT NULL
), weekly AS (
  SELECT a.campus_name, a.week, c.active_students,
         COUNT(*) FILTER (WHERE src = 'yt_project') AS yt_project,
         COUNT(*) FILTER (WHERE src = 'yt_concept') AS yt_concept,
         COUNT(*) FILTER (WHERE src = 'pa_project') AS pa_project
    FROM activity a JOIN counts c ON c.campus_id = a.campus_id
   GROUP BY a.campus_name, a.week, c.active_students
)
SELECT campus_name, week, active_students,
       (yt_project + yt_concept + pa_project) AS "Total Learnings",
       ROUND((yt_project + yt_concept + pa_project)::numeric / NULLIF(active_students, 0) * 100, 2) AS "% Learning per Active Student",
       yt_project AS "Youtube Project",
       yt_concept AS "Youtube Concept",
       pa_project AS "Project Analyzer Projects"
  FROM weekly
 ORDER BY week DESC, "% Learning per Active Student" ASC;

-- Superset reads these views through a read-only login (apply-dash-views.js with DASH_READER_PASSWORD creates it);
-- re-granted here because the schema was just rebuilt.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'superset_dash') THEN
    GRANT USAGE ON SCHEMA dash TO superset_dash;
    GRANT SELECT ON ALL TABLES IN SCHEMA dash TO superset_dash;
  END IF;
END $$;
