-- Production dataset "Student Missing Phase Submission Details" (Superset export 2026-10-24), runs on MAIN.
-- columns: last_submitted_phase, phase_id, campus_name, phase_name, school_name, student_name, missing_type, email, full_phase_name
-- Missing submissions per campus / school / phase.
-- Same eligibility and submission logic as the campus-wise phase summary query:
-- a student "has submitted" a phase if they have any YT Tool or Athena submission for it.
-- A row is returned for every eligible student x phase where NO submission exists.
-- missing_type:
--   'Not started'   -> student has no submission in any phase
--   'Skipped (gap)' -> student submitted a later phase but not this one
--   'Pending'       -> phase is after the student's latest submitted phase (not reached yet)
-- Remove the campus filter in the last WHERE to see all campuses.

WITH eligible_students AS (
  SELECT
    CAST(c."ID" AS TEXT) AS campus_id,
    TRIM(c."Campus_Name") AS campus_name,
    LOWER(TRIM(s."Navgurukul_Email")) AS email,
    TRIM(CONCAT_WS(' ', s."Name.first_name", s."Name.last_name")) AS student_name,
    TRIM(s."Select_School1") AS student_school
  FROM public.tbl_ghar_add_student AS s
  JOIN public.tbl_ghar_create_campus AS c
    ON CAST(c."ID" AS TEXT) = CAST(s."Select_Campus" AS TEXT)
  WHERE s."Status" IN ('Active', 'Intern (In Campus)')
    AND (
      TRIM(s."Select_School1") = 'School of Programming'
      OR TRIM(s."Select_School1") IN (
        'Bachelor of Computer Applications- Eternal 24-27',
        'Bachelor of Computer Applications- Eternal 25-28',
        'Bachelor of Computer Applications- Eternal 26-29'
      )
    )
    AND s."Navgurukul_Email" IS NOT NULL
    AND TRIM(s."Navgurukul_Email") <> ''
),
yt_phase_dates AS (
  SELECT
    es.email,
    ph.id AS phase_id,
    MIN(ype.created_at) AS first_submission
  FROM eligible_students AS es
  JOIN public.tbl_ailabs_ytfeedback_project_evaluation AS ype
    ON LOWER(TRIM(ype.email)) = es.email
  JOIN public.tbl_ailabls_ytfeedback_phases AS ph
    ON LOWER(TRIM(ph.phase_name)) = LOWER(TRIM(ype.project_name))
  GROUP BY es.email, ph.id
),
pa_phase_dates AS (
  SELECT
    es.email,
    CASE WHEN pp.phase ~ '^phase[0-9]+$' THEN CAST(REGEXP_REPLACE(pp.phase, '^phase', '') AS INT) END AS phase_id,
    MIN(COALESCE(pp."updatedAt", pp."createdAt")) AS first_submission
  FROM eligible_students AS es
  JOIN public.tbl_ailabs_projectanalyzer_users_af AS pu
    ON LOWER(TRIM(pu.email)) = es.email
  JOIN public.tbl_ailabs_projectanalyzer_projects_af AS pp
    ON pp."userId" = pu._id
  WHERE pp.phase ~ '^phase[0-9]+$' and status='completed'
  GROUP BY es.email, pp.phase
),
all_phase_dates AS (
  SELECT email, phase_id, first_submission FROM yt_phase_dates
  UNION ALL
  SELECT email, phase_id, first_submission FROM pa_phase_dates
),
student_phase_first AS (
  SELECT email, phase_id, MIN(first_submission) AS first_submission
  FROM all_phase_dates
  GROUP BY email, phase_id
),
student_max_phase AS (
  SELECT email, MAX(phase_id) AS max_submitted_phase
  FROM student_phase_first
  GROUP BY email
),
phases AS (
  SELECT id AS phase_id, phase_name
  FROM public.tbl_ailabls_ytfeedback_phases
)

-- ===== Detail: one row per student per missing phase =====
SELECT
  es.campus_name,
  es.student_school AS school_name,
  es.student_name,
  es.email,
  ph.phase_id,
  CONCAT('Phase ', ph.phase_id) AS phase_name,
  ph.phase_name as full_phase_name,
  smp.max_submitted_phase AS last_submitted_phase,
  CASE
    WHEN smp.max_submitted_phase IS NULL THEN 'Not started'
    WHEN ph.phase_id < smp.max_submitted_phase THEN 'Skipped (gap)'
    ELSE 'Pending'
  END AS missing_type
FROM eligible_students AS es
CROSS JOIN phases AS ph
LEFT JOIN student_phase_first AS spf
  ON spf.email = es.email AND spf.phase_id = ph.phase_id
LEFT JOIN student_max_phase AS smp
  ON smp.email = es.email
WHERE spf.email IS NULL
ORDER BY es.campus_name, es.student_school, ph.phase_id, es.email
