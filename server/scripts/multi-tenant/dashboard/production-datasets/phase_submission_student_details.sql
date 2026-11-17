-- Production dataset "Phase Submission Student Details" (Superset export 2026-10-24), runs on MAIN.
-- columns: first_submission, campus_name, phase_name, school_name, email, student_name
SELECT
  campus_name AS campus_name,
  school_name AS school_name,
  student_name as student_name,
  email AS email,
  phase_name AS phase_name,
  first_submission AS first_submission
FROM (
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
    WHERE
      s."Status" IN ('Active', 'Intern (In Campus)')
      AND (
        TRIM(s."Select_School1") = 'School of Programming'
        OR TRIM(s."Select_School1") IN (
          'Bachelor of Computer Applications- Eternal 24-27',
          'Bachelor of Computer Applications- Eternal 25-28',
          'Bachelor of Computer Applications- Eternal 26-29'
        )
      )
      AND NOT s."Navgurukul_Email" IS NULL
      AND TRIM(s."Navgurukul_Email") <> ''
  ), yt_phase_dates AS (
    SELECT
      es.campus_id,
      es.campus_name,
      es.student_name,
      es.email,
      es.student_school,
      ph.id AS phase_id,
      MIN(ype.created_at) AS first_submission
    FROM eligible_students AS es
    JOIN public.tbl_ailabs_ytfeedback_project_evaluation AS ype
      ON LOWER(TRIM(ype.email)) = es.email
    JOIN public.tbl_ailabls_ytfeedback_phases AS ph
      ON LOWER(TRIM(ph.phase_name)) = LOWER(TRIM(ype.project_name))
    GROUP BY
      es.campus_id,
      es.campus_name,
      es.student_name,
      es.email,
      es.student_school,
      ph.id
  ), pa_phase_dates AS (
    SELECT
      es.campus_id,
      es.campus_name,
      es.student_name,
      es.email,
      es.student_school,
      CASE
        WHEN pp.phase ~ '^phase[0-9]+$'
        THEN CAST(REGEXP_REPLACE(pp.phase, '^phase', '') AS INT)
      END AS phase_id,
      MIN(COALESCE(pp."updatedAt", pp."createdAt")) AS first_submission
    FROM eligible_students AS es
    JOIN public.tbl_ailabs_projectanalyzer_users_af AS pu
      ON LOWER(TRIM(pu.email)) = es.email
    JOIN public.tbl_ailabs_projectanalyzer_projects_af AS pp
      ON pp."userId" = pu._id
    WHERE
      pp.phase ~ '^phase[0-9]+$' AND status = 'completed'
    GROUP BY
      es.campus_id,
      es.campus_name,
      es.student_name,
      es.email,
      es.student_school,
      pp.phase
  ), all_phase_dates AS (
    SELECT
      *
    FROM yt_phase_dates
    UNION ALL
    SELECT
      *
    FROM pa_phase_dates
  ), student_phase_first AS (
    SELECT
      campus_id,
      campus_name,
      student_name,
      email,
      student_school,
      phase_id,
      MIN(first_submission) AS first_submission
    FROM all_phase_dates
    GROUP BY
      campus_id,
      campus_name,
      student_name,
      email,
      student_school,
      phase_id
  ), student_phase_gaps AS (
    SELECT
      spf.campus_id,
      spf.campus_name,
      spf.student_name,
      spf.email,
      spf.student_school,
      spf.phase_id,
      spf.first_submission,
      CASE
        WHEN spf.phase_id = 1
        THEN 1
        WHEN prev.first_submission IS NULL
        THEN NULL
        ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM spf.first_submission - prev.first_submission) / 86400))
      END AS days_taken
    FROM student_phase_first AS spf
    LEFT JOIN student_phase_first AS prev
      ON prev.email = spf.email AND prev.phase_id = spf.phase_id - 1
  )
  SELECT
    campus_name,
    student_school AS school_name,
    student_name,
    phase_id,
    CONCAT('Phase ', phase_id) AS phase_name,
    email,
    first_submission
  FROM student_phase_gaps
  ORDER BY
    campus_name,
    student_school,
    phase_id,
    email
) AS virtual_table
LIMIT 1000
