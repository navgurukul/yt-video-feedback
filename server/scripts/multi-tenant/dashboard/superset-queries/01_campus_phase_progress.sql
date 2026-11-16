-- ==================================================================================
-- Dashboard component: Campus Phase Progress
-- Database: TEST (test_ghar_central_db). Columns: campus_name, school_name, total_students, avg_write_grade, avg_speak_grade, phase1 .. phase7
-- Students per CURRENT phase per campus + school (current = highest phase with a YT project
-- video or any Project Analyzer project, + 1, max 7) and the average English grades.
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
yt_project AS (           -- YT project-explanation evaluations; phase = the phase whose name the
                          -- video was saved under (same rule as production)
  SELECT e.id, LOWER(TRIM(e.email)) AS email, np.phase_no, np.phase_name, e.created_at,
         e.project_explanation_evaluationjson AS evaluation_json,
         (e.project_explanation_evaluationjson IS NOT NULL
          AND TRIM(e.project_explanation_evaluationjson) <> '') AS has_evaluation
    FROM public.tbl_ailabs_ytfeedback_project_evaluation e
    JOIN scope s ON s.institution_id = e.institution_id
    JOIN nav_phases np ON LOWER(TRIM(np.phase_name)) = LOWER(TRIM(e.project_name))
    -- To also count videos saved under an OLD phase name (production does not), use the
    -- phase link instead:   JOIN nav_phases np ON np.phase_uuid = e.phase_id
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
campus_schools AS (       -- schools taught at each campus (copied from production)
  SELECT DISTINCT a."Campuses"::text AS campus_id, TRIM(a."Schools_Name") AS school_name
    FROM public.tbl_ghar_assign_school_to_campus a
   WHERE TRIM(a."Schools_Name") IN ('School of Programming',
                 'Bachelor of Computer Applications- Eternal 24-27',
                 'Bachelor of Computer Applications- Eternal 25-28',
                 'Bachelor of Computer Applications- Eternal 26-29')
),
student_current_phase AS (
  SELECT es.campus_id, es.email, es.student_school,
         CASE WHEN mp.max_phase IS NULL THEN 1
              WHEN mp.max_phase >= 7    THEN 7
              ELSE mp.max_phase + 1 END AS phase_no
    FROM eligible_students es
    LEFT JOIN (SELECT email, MAX(phase_no) AS max_phase
                 FROM (SELECT email, phase_no FROM yt_project
                       UNION ALL
                       SELECT email, phase_no FROM pa_project) x     -- any PA project, as production
                GROUP BY email) mp ON mp.email = es.email
),
campus_school_totals AS (
  SELECT es.campus_id, es.campus_name, cs.school_name, COUNT(DISTINCT es.email) AS total_students
    FROM eligible_students es
    JOIN campus_schools cs ON cs.campus_id = es.campus_id AND LOWER(cs.school_name) = LOWER(es.student_school)
   GROUP BY es.campus_id, es.campus_name, cs.school_name
),
campus_school_phase_counts AS (
  SELECT cp.campus_id, cs.school_name, cp.phase_no, COUNT(DISTINCT cp.email) AS student_count
    FROM student_current_phase cp
    JOIN campus_schools cs ON cs.campus_id = cp.campus_id AND LOWER(cs.school_name) = LOWER(cp.student_school)
   GROUP BY cp.campus_id, cs.school_name, cp.phase_no
),
latest_grade AS (         -- latest English grade per student (copied from production)
  SELECT 'write' AS kind, g.*
    FROM (SELECT DISTINCT ON ("Name") "Name"::text AS student_id, "Grade" AS grade
            FROM public."tbl_ghar_Write_Improve_Data"
           ORDER BY "Name", "Completion_Date" DESC NULLS LAST) g
  UNION ALL
  SELECT 'speak', g.*
    FROM (SELECT DISTINCT ON ("Name") "Name"::text AS student_id, "Grade" AS grade
            FROM public."tbl_ghar_Speak_Improve_Data"
           ORDER BY "Name", "Completion_Date" DESC NULLS LAST) g
),
campus_grades AS (        -- average grade, as a grade label
  SELECT campus_id, school_name, kind,
         CASE ROUND(AVG(grade_num)::numeric)
           WHEN 0 THEN 'Absent in Exam' WHEN 1 THEN '-A1' WHEN 2 THEN 'A1' WHEN 3 THEN 'A2'
           WHEN 4 THEN 'B1' WHEN 5 THEN 'B2' WHEN 6 THEN 'C1' WHEN 7 THEN 'C2' END AS grade
    FROM (SELECT es.campus_id, cs.school_name, g.kind,
                 CASE g.grade WHEN 'Absent in Exam' THEN 0 WHEN '-A1' THEN 1 WHEN 'A1' THEN 2 WHEN 'A2' THEN 3
                              WHEN 'B1' THEN 4 WHEN 'B2' THEN 5 WHEN 'C1' THEN 6 WHEN 'C2' THEN 7 END AS grade_num
            FROM eligible_students es
            JOIN campus_schools cs ON cs.campus_id = es.campus_id AND LOWER(cs.school_name) = LOWER(es.student_school)
            JOIN latest_grade g ON g.student_id = es.student_id
           WHERE g.grade IS NOT NULL) x
   GROUP BY campus_id, school_name, kind
)
SELECT t.campus_name,
       t.school_name,
       t.total_students,
       MAX(gw.grade) AS avg_write_grade,
       MAX(gs.grade) AS avg_speak_grade,
       COALESCE(MAX(pc.student_count) FILTER (WHERE pc.phase_no = 1), 0) AS phase1,
       COALESCE(MAX(pc.student_count) FILTER (WHERE pc.phase_no = 2), 0) AS phase2,
       COALESCE(MAX(pc.student_count) FILTER (WHERE pc.phase_no = 3), 0) AS phase3,
       COALESCE(MAX(pc.student_count) FILTER (WHERE pc.phase_no = 4), 0) AS phase4,
       COALESCE(MAX(pc.student_count) FILTER (WHERE pc.phase_no = 5), 0) AS phase5,
       COALESCE(MAX(pc.student_count) FILTER (WHERE pc.phase_no = 6), 0) AS phase6,
       COALESCE(MAX(pc.student_count) FILTER (WHERE pc.phase_no = 7), 0) AS phase7
  FROM campus_school_totals t
  LEFT JOIN campus_school_phase_counts pc ON pc.campus_id = t.campus_id AND pc.school_name = t.school_name
  LEFT JOIN campus_grades gw ON gw.campus_id = t.campus_id AND gw.school_name = t.school_name AND gw.kind = 'write'
  LEFT JOIN campus_grades gs ON gs.campus_id = t.campus_id AND gs.school_name = t.school_name AND gs.kind = 'speak'
 GROUP BY t.campus_id, t.campus_name, t.school_name, t.total_students
 ORDER BY t.campus_name, t.school_name
