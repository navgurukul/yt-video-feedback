-- ==================================================================================
-- Dashboard component: Student Phase Submission Details
-- Database: TEST (test_ghar_central_db). Columns: campus_name, school_name, student_name, email, phase_name, first_submission
-- First submission of every student in every phase they submitted (time filter: first_submission).
-- ==================================================================================
WITH
scope AS (                -- Navgurukul / School of Programming in the multi-tenant tools
  SELECT i.id AS institution_id, p.id AS program_id
    FROM public.institutions i
    JOIN public.programs p ON p.institution_id = i.id
   WHERE i.slug = 'navgurukul' AND p.name = 'School of Programming'
),
nav_phases AS (           -- phase number = the "Phase N" in the phase name (sort order otherwise)
  SELECT ph.id AS phase_uuid,
         COALESCE((regexp_match(ph.name, '^\s*Phase\s+(\d+)', 'i'))[1]::int, ph.sort_order) AS phase_no,
         ph.name AS phase_name
    FROM public.phases ph
    JOIN scope s ON s.program_id = ph.program_id
   WHERE ph.is_active
),
eligible_students AS (        -- students (copied from production: tbl_ghar_*)
  SELECT c."ID"::text                                                   AS campus_id,
         TRIM(c."Campus_Name")                                          AS campus_name,
         s."ID"::text                                                   AS student_id,
         LOWER(TRIM(s."Navgurukul_Email"))                              AS email,
         TRIM(CONCAT_WS(' ', s."Name.first_name", s."Name.last_name"))  AS student_name,
         s."Joining_Date"                                               AS joining_date,
         TRIM(s."Select_School1")                                       AS student_school,
         s."Status"                                                     AS student_status
    FROM public.tbl_ghar_add_student s
    JOIN public.tbl_ghar_create_campus c ON c."ID"::text = s."Select_Campus"::text
   WHERE s."Status" IN ('Active', 'Intern (In Campus)')
     AND TRIM(s."Select_School1") IN ('School of Programming',
                 'Bachelor of Computer Applications- Eternal 24-27',
                 'Bachelor of Computer Applications- Eternal 25-28',
                 'Bachelor of Computer Applications- Eternal 26-29')
     AND s."Navgurukul_Email" IS NOT NULL
     AND TRIM(s."Navgurukul_Email") <> ''
),
yt_project AS (           -- YT project-explanation evaluations, matched to a phase by their phase link
  SELECT e.id, LOWER(TRIM(e.email)) AS email, np.phase_no, np.phase_name, e.created_at,
         e.project_explanation_evaluationjson AS evaluation_json,
         (e.project_explanation_evaluationjson IS NOT NULL
          AND TRIM(e.project_explanation_evaluationjson) <> '') AS has_evaluation
    FROM public.tbl_ailabs_ytfeedback_project_evaluation e
    JOIN scope s ON s.institution_id = e.institution_id
    LEFT JOIN public.legacy_phase_name_map m           -- rows saved under an old phase name
           ON e.phase_id IS NULL AND m.old_name = e.project_name
    JOIN nav_phases np
      ON np.phase_uuid = COALESCE(e.phase_id, m.phase_id)
      OR (e.phase_id IS NULL AND m.phase_id IS NULL
          AND LOWER(TRIM(np.phase_name)) = LOWER(TRIM(e.project_name)))
),
pa_project AS (           -- Project Analyzer projects, matched to a phase through their phase spec
  SELECT pp."_id" AS project_id, LOWER(TRIM(pu.email)) AS email, np.phase_no, np.phase_name,
         LOWER(TRIM(COALESCE(pp.status, ''))) AS status,
         pp."finalFeedback"::jsonb AS final_feedback,
         COALESCE(pp."updatedAt", pp."createdAt") AT TIME ZONE 'UTC' AS evaluated_at   -- *_af times are UTC
    FROM public.tbl_ailabs_projectanalyzer_projects_af pp
    JOIN scope s ON s.institution_id = pp.institution_id
    JOIN public.tbl_ailabs_projectanalyzer_users_af pu ON pu."_id" = pp."userId"
    LEFT JOIN public.pa_phase_specs ps ON ps.id = pp.pa_phase_spec_id
    JOIN nav_phases np
      ON np.phase_uuid = ps.phase_id
      OR (ps.id IS NULL AND pp.phase ~ '^phase[0-9]+$'
          AND np.phase_no = substring(pp.phase FROM 6)::int)
),
student_phase_first AS ( -- first submission per student and phase: YT project video or completed PA project
  SELECT es.campus_id, es.campus_name, es.student_name, es.email, es.student_school, x.phase_no,
         MIN(x.submitted_at) AS first_submission
    FROM eligible_students es
    JOIN (SELECT email, phase_no, created_at AS submitted_at FROM yt_project
          UNION ALL
          SELECT email, phase_no, evaluated_at FROM pa_project WHERE status = 'completed') x ON x.email = es.email
   GROUP BY es.campus_id, es.campus_name, es.student_name, es.email, es.student_school, x.phase_no
)
SELECT campus_name,
       student_school               AS school_name,
       student_name,
       email,
       CONCAT('Phase ', phase_no)   AS phase_name,
       first_submission
  FROM student_phase_first
 ORDER BY campus_name, student_school, phase_no, email
