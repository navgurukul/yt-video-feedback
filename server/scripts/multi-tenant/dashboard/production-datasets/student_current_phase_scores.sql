-- Production dataset "Student Current Phase and Phase Scores" (Superset export 2026-10-24), runs on MAIN.
-- columns: phase1_score, phase2_score, phase3_score, phase4_score, phase5_score, phase6_score, phase7_score, time_on_campus_days, total_present_days, campus_name, speak_grade, expected_phase, current_phase, school_name, write_grade, student_name, student_status, email
SELECT campus_name AS campus_name, school_name AS school_name, student_name AS student_name, email AS email, student_status AS student_status, time_on_campus_days AS time_on_campus_days, total_present_days AS total_present_days, write_grade AS write_grade, speak_grade AS speak_grade, current_phase AS current_phase, expected_phase AS expected_phase, phase1_score AS phase1_score, phase2_score AS phase2_score, phase3_score AS phase3_score, phase4_score AS phase4_score, phase5_score AS phase5_score, phase6_score AS phase6_score, phase7_score AS phase7_score 
FROM (SELECT
  campus_name AS campus_name,
  school_name AS school_name,
  student_name AS student_name,
  email AS email,
  student_status AS student_status,
  time_on_campus_days AS time_on_campus_days,
  total_present_days AS total_present_days,
  write_grade AS write_grade,
  speak_grade AS speak_grade,
  current_phase AS current_phase,
  expected_phase AS expected_phase,
  phase1_score AS phase1_score,
  phase2_score AS phase2_score,
  phase3_score AS phase3_score,
  phase4_score AS phase4_score,
  phase5_score AS phase5_score,
  phase6_score AS phase6_score,
  phase7_score AS phase7_score
FROM (
  SELECT
    campus_name AS campus_name,
    school_name AS school_name,
    student_name AS student_name,
    student_status AS student_status,
    email AS email,
    time_on_campus_days AS time_on_campus_days,
    total_present_days AS total_present_days,
    write_grade AS write_grade,
    speak_grade AS speak_grade,
    current_phase AS current_phase,
    expected_phase AS expected_phase,
    phase1_score AS phase1_score,
    phase2_score AS phase2_score,
    phase3_score AS phase3_score,
    phase4_score AS phase4_score,
    phase5_score AS phase5_score,
    phase6_score AS phase6_score,
    phase7_score AS phase7_score
  FROM (
    SELECT
      campus_name,
      school_name,
      student_name,
      student_status,
      email,
      time_on_campus_days,
      total_present_days,
      write_grade,
      speak_grade,
      current_phase,
      expected_phase,
      phase1_score,
      phase2_score,
      phase3_score,
      phase4_score,
      phase5_score,
      phase6_score,
      phase7_score
    FROM (
      SELECT
        campus_name,
        school_name,
        student_name,
        email,
        student_status,
        time_on_campus_days,
        total_present_days,
        write_grade,
        speak_grade,
        current_phase,
        expected_phase,
        phase1_score,
        phase2_score,
        phase3_score,
        phase4_score,
        phase5_score,
        phase6_score,
        phase7_score
      FROM (
        SELECT
          campus_name,
          school_name,
          student_name,
          email,
          student_status,
          time_on_campus_days,
          total_present_days,
          write_grade,
          speak_grade,
          current_phase,
          expected_phase,
          phase1_score,
          phase2_score,
          phase3_score,
          phase4_score,
          phase5_score,
          phase6_score,
          phase7_score
        FROM (
          SELECT
            campus_name,
            school_name,
            student_name,
            email,
            student_status,
            time_on_campus_days,
            total_present_days,
            write_grade,
            speak_grade,
            current_phase,
            expected_phase,
            phase1_score,
            phase2_score,
            phase3_score,
            phase4_score,
            phase5_score,
            phase6_score,
            phase7_score
          FROM (
            SELECT
              campus_name,
              school_name,
              student_name,
              email,
              time_on_campus_days,
              total_present_days,
              write_grade,
              speak_grade,
              current_phase,
              expected_phase,
              phase1_score,
              phase2_score,
              phase3_score,
              phase4_score,
              phase5_score,
              phase6_score,
              phase7_score,
              student_status
            FROM (
              SELECT
                campus_name,
                school_name,
                student_name,
                email,
                time_on_campus_days,
                total_present_days,
                write_grade,
                speak_grade,
                current_phase,
                expected_phase,
                phase1_score,
                phase2_score,
                phase3_score,
                phase4_score,
                phase5_score,
                phase6_score,
                phase7_score,
                student_status
              FROM (
                WITH eligible_students AS (
                  SELECT
                    CAST(c."ID" AS TEXT) AS campus_id,
                    TRIM(c."Campus_Name") AS campus_name,
                    CAST(s."ID" AS TEXT) AS student_id,
                    LOWER(TRIM(s."Navgurukul_Email")) AS email,
                    TRIM(CONCAT_WS(' ', s."Name.first_name", s."Name.last_name")) AS student_name,
                    s."Joining_Date" AS joining_date,
                    TRIM(s."Select_School1") AS student_school,
                    s."Status" AS student_status
                  FROM PUBLIC.tbl_ghar_add_student AS s
                  JOIN PUBLIC.tbl_ghar_create_campus AS c
                    ON CAST(c."ID" AS TEXT) = CAST(s."Select_Campus" AS TEXT)
                  WHERE
                    (
                      s."Status" = 'Active'
                      OR s."Status" = 'Intern (In Campus)'
                      OR s."Status" = 'Intern (Out Campus)'
                      OR s."Status" = 'InActive'
                    )
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
                ), latest_write_grade AS (
                  SELECT DISTINCT ON ("Name")
                    CAST("Name" AS TEXT) AS student_id,
                    "Grade" AS write_grade,
                    "Completion_Date"
                  FROM public."tbl_ghar_Write_Improve_Data"
                  ORDER BY
                    "Name",
                    "Completion_Date" DESC NULLS LAST
                ), latest_speak_grade AS (
                  SELECT DISTINCT ON ("Name")
                    CAST("Name" AS TEXT) AS student_id,
                    "Grade" AS speak_grade,
                    "Completion_Date"
                  FROM public."tbl_ghar_Speak_Improve_Data"
                  ORDER BY
                    "Name",
                    "Completion_Date" DESC NULLS LAST
                ), latest_yt_eval AS (
                  SELECT DISTINCT ON (LOWER(TRIM(pe.email)), ph.id)
                    LOWER(TRIM(pe.email)) AS email,
                    ph.id AS phase_id,
                    pe.created_at AS evaluated_at,
                    pe.project_explanation_evaluationjson
                  FROM tbl_ailabls_ytfeedback_phases AS ph
                  INNER JOIN tbl_ailabs_ytfeedback_project_evaluation AS pe
                    ON LOWER(TRIM(pe.project_name)) = LOWER(TRIM(ph.phase_name))
                  WHERE
                    NOT pe.project_explanation_evaluationjson IS NULL
                    AND TRIM(pe.project_explanation_evaluationjson) <> ''
                  ORDER BY
                    LOWER(TRIM(pe.email)),
                    ph.id,
                    pe.created_at DESC
                ), latest_pa_eval AS (
                  SELECT DISTINCT ON (LOWER(TRIM(pu.email)), phase_num)
                    LOWER(TRIM(pu.email)) AS email,
                    phase_num AS phase_id,
                    COALESCE(pp."updatedAt", pp."createdAt") AS evaluated_at,
                    pp."finalFeedback"
                  FROM (
                    SELECT
                      pp.*,
                      CAST((
                        REGEXP_MATCH(pp.phase, '^phase([0-9]+)$')
                      )[1] AS INT) AS phase_num
                    FROM tbl_ailabs_projectanalyzer_projects_af AS pp
                    WHERE
                      LOWER(TRIM(COALESCE(pp.status, ''))) = 'completed'
                      AND NOT pp."finalFeedback" IS NULL
                      AND pp.phase ~ '^phase[0-9]+$'
                  ) AS pp
                  INNER JOIN tbl_ailabs_projectanalyzer_users_af AS pu
                    ON pu._id = pp."userId"
                  ORDER BY
                    LOWER(TRIM(pu.email)),
                    phase_num,
                    COALESCE(pp."updatedAt", pp."createdAt") DESC NULLS LAST
                ), yt_phase_dates AS (
                  SELECT
                    LOWER(TRIM(pe.email)) AS email,
                    ph.id AS phase_id,
                    MAX(pe.created_at) AS last_submission
                  FROM tbl_ailabls_ytfeedback_phases AS ph
                  INNER JOIN tbl_ailabs_ytfeedback_project_evaluation AS pe
                    ON LOWER(TRIM(pe.project_name)) = LOWER(TRIM(ph.phase_name))
                  WHERE
                    NOT pe.project_explanation_evaluationjson IS NULL
                    AND TRIM(pe.project_explanation_evaluationjson) <> ''
                  GROUP BY
                    LOWER(TRIM(pe.email)),
                    ph.id
                ), pa_phase_dates AS (
                  SELECT
                    LOWER(TRIM(pu.email)) AS email,
                    CAST((
                      REGEXP_MATCH(pp.phase, '^phase([0-9]+)$')
                    )[1] AS INT) AS phase_id,
                    MAX(COALESCE(pp."updatedAt", pp."createdAt")) AS last_submission
                  FROM tbl_ailabs_projectanalyzer_projects_af AS pp
                  INNER JOIN tbl_ailabs_projectanalyzer_users_af AS pu
                    ON pu._id = pp."userId"
                  WHERE
                    pp.phase ~ '^phase[0-9]+$' AND LOWER(TRIM(COALESCE(pp.status, ''))) = 'completed'
                  GROUP BY
                    LOWER(TRIM(pu.email)),
                    pp.phase
                ), all_phase_dates AS (
                  SELECT
                    email,
                    phase_id,
                    last_submission
                  FROM yt_phase_dates
                  UNION ALL
                  SELECT
                    email,
                    phase_id,
                    last_submission
                  FROM pa_phase_dates
                ), student_latest_submitted AS (
                  SELECT DISTINCT ON (email)
                    email,
                    phase_id AS last_submitted_phase
                  FROM all_phase_dates
                  ORDER BY
                    email,
                    phase_id DESC NULLS LAST
                ), weightages AS (
                  SELECT
                    CAST((
                      REGEXP_MATCH(CAST(phaseid AS TEXT), '(\d+)')
                    )[1] AS INT) AS phase_id,
                    TRIM(
                      REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM(parametername)), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')
                    ) AS norm_fullname,
                    TRIM(
                      REGEXP_REPLACE(
                        REGEXP_REPLACE(LOWER(TRIM(COALESCE(shortparametername, parametername))), '[^a-z0-9 ]', ' ', 'g'),
                        '\s+',
                        ' ',
                        'g'
                      )
                    ) AS norm_shortname,
                    condensedweightage
                  FROM PUBLIC.tbl_ailabs_phasewise_parameter_weightages
                  WHERE
                    NOT condensedweightage IS NULL
                ), yt_scores AS (
                  SELECT
                    lye.email,
                    lye.phase_id,
                    ROUND(
                      CAST(SUM(
                        ROUND(
                          CAST(CASE LOWER(TRIM(param.value ->> 'level'))
                            WHEN 'beginner'
                            THEN (
                              1.0 / 4
                            ) * w.condensedweightage
                            WHEN 'intermediate'
                            THEN (
                              2.0 / 4
                            ) * w.condensedweightage
                            WHEN 'advanced'
                            THEN (
                              3.0 / 4
                            ) * w.condensedweightage
                            WHEN 'expert'
                            THEN (
                              4.0 / 4
                            ) * w.condensedweightage
                          END AS DECIMAL),
                          2
                        )
                      ) AS DECIMAL),
                      2
                    ) AS phase_score
                  FROM latest_yt_eval AS lye
                  JOIN eligible_students AS es
                    ON es.email = lye.email
                  CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(CAST(lye.project_explanation_evaluationjson AS JSONB) -> 'parameters') AS param
                  JOIN LATERAL (
                    SELECT
                      condensedweightage
                    FROM weightages AS w
                    WHERE
                      w.phase_id = lye.phase_id
                      AND (
                        w.norm_fullname = TRIM(
                          REGEXP_REPLACE(REGEXP_REPLACE(LOWER(param.value ->> 'name'), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')
                        )
                        OR w.norm_shortname = TRIM(
                          REGEXP_REPLACE(REGEXP_REPLACE(LOWER(param.value ->> 'name'), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')
                        )
                        OR TRIM(
                          REGEXP_REPLACE(REGEXP_REPLACE(LOWER(param.value ->> 'name'), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')
                        ) LIKE '%' || w.norm_fullname || '%'
                        OR w.norm_fullname LIKE '%' || TRIM(
                          REGEXP_REPLACE(REGEXP_REPLACE(LOWER(param.value ->> 'name'), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')
                        ) || '%'
                        OR TRIM(
                          REGEXP_REPLACE(REGEXP_REPLACE(LOWER(param.value ->> 'name'), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')
                        ) LIKE '%' || w.norm_shortname || '%'
                        OR w.norm_shortname LIKE '%' || TRIM(
                          REGEXP_REPLACE(REGEXP_REPLACE(LOWER(param.value ->> 'name'), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')
                        ) || '%'
                      )
                    ORDER BY
                      CAST((
                        w.norm_fullname = TRIM(
                          REGEXP_REPLACE(REGEXP_REPLACE(LOWER(param.value ->> 'name'), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')
                        )
                      ) AS INT) DESC,
                      CAST((
                        w.norm_shortname = TRIM(
                          REGEXP_REPLACE(REGEXP_REPLACE(LOWER(param.value ->> 'name'), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')
                        )
                      ) AS INT) DESC
                    LIMIT 1
                  ) AS w
                    ON TRUE
                  WHERE
                    LOWER(TRIM(param.value ->> 'level')) IN ('beginner', 'intermediate', 'advanced', 'expert')
                  GROUP BY
                    lye.email,
                    lye.phase_id
                ), pa_scores AS (
                  SELECT
                    lpe.email,
                    lpe.phase_id,
                    ROUND(
                      CAST(SUM(
                        ROUND(
                          CAST(CASE LOWER(TRIM(crit.value ->> 'assignedLevel'))
                            WHEN 'beginner'
                            THEN (
                              1.0 / 4
                            ) * w.condensedweightage
                            WHEN 'intermediate'
                            THEN (
                              2.0 / 4
                            ) * w.condensedweightage
                            WHEN 'advanced'
                            THEN (
                              3.0 / 4
                            ) * w.condensedweightage
                            WHEN 'expert'
                            THEN (
                              4.0 / 4
                            ) * w.condensedweightage
                          END AS DECIMAL),
                          2
                        )
                      ) AS DECIMAL),
                      2
                    ) AS phase_score
                  FROM latest_pa_eval AS lpe
                  JOIN eligible_students AS es
                    ON es.email = lpe.email
                  CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(CAST(lpe."finalFeedback" AS JSONB) -> 'criterionWiseEvaluation') AS crit
                  JOIN LATERAL (
                    SELECT
                      condensedweightage
                    FROM weightages AS w
                    WHERE
                      w.phase_id = lpe.phase_id
                      AND (
                        w.norm_fullname = TRIM(
                          REGEXP_REPLACE(
                            REGEXP_REPLACE(LOWER(crit.value ->> 'parameter'), '[^a-z0-9 ]', ' ', 'g'),
                            '\s+',
                            ' ',
                            'g'
                          )
                        )
                        OR w.norm_shortname = TRIM(
                          REGEXP_REPLACE(
                            REGEXP_REPLACE(LOWER(crit.value ->> 'parameter'), '[^a-z0-9 ]', ' ', 'g'),
                            '\s+',
                            ' ',
                            'g'
                          )
                        )
                        OR TRIM(
                          REGEXP_REPLACE(
                            REGEXP_REPLACE(LOWER(crit.value ->> 'parameter'), '[^a-z0-9 ]', ' ', 'g'),
                            '\s+',
                            ' ',
                            'g'
                          )
                        ) LIKE '%' || w.norm_fullname || '%'
                        OR w.norm_fullname LIKE '%' || TRIM(
                          REGEXP_REPLACE(
                            REGEXP_REPLACE(LOWER(crit.value ->> 'parameter'), '[^a-z0-9 ]', ' ', 'g'),
                            '\s+',
                            ' ',
                            'g'
                          )
                        ) || '%'
                        OR TRIM(
                          REGEXP_REPLACE(
                            REGEXP_REPLACE(LOWER(crit.value ->> 'parameter'), '[^a-z0-9 ]', ' ', 'g'),
                            '\s+',
                            ' ',
                            'g'
                          )
                        ) LIKE '%' || w.norm_shortname || '%'
                        OR w.norm_shortname LIKE '%' || TRIM(
                          REGEXP_REPLACE(
                            REGEXP_REPLACE(LOWER(crit.value ->> 'parameter'), '[^a-z0-9 ]', ' ', 'g'),
                            '\s+',
                            ' ',
                            'g'
                          )
                        ) || '%'
                      )
                    ORDER BY
                      CAST((
                        w.norm_fullname = TRIM(
                          REGEXP_REPLACE(
                            REGEXP_REPLACE(LOWER(crit.value ->> 'parameter'), '[^a-z0-9 ]', ' ', 'g'),
                            '\s+',
                            ' ',
                            'g'
                          )
                        )
                      ) AS INT) DESC,
                      CAST((
                        w.norm_shortname = TRIM(
                          REGEXP_REPLACE(
                            REGEXP_REPLACE(LOWER(crit.value ->> 'parameter'), '[^a-z0-9 ]', ' ', 'g'),
                            '\s+',
                            ' ',
                            'g'
                          )
                        )
                      ) AS INT) DESC
                    LIMIT 1
                  ) AS w
                    ON TRUE
                  WHERE
                    LOWER(TRIM(crit.value ->> 'assignedLevel')) IN ('beginner', 'intermediate', 'advanced', 'expert')
                  GROUP BY
                    lpe.email,
                    lpe.phase_id
                ), student_phase_scores AS (
                  SELECT
                    email,
                    phase_id,
                    ROUND(CAST(SUM(phase_score) AS DECIMAL), 2) AS phase_score
                  FROM (
                    SELECT
                      email,
                      phase_id,
                      phase_score
                    FROM yt_scores
                    UNION ALL
                    SELECT
                      email,
                      phase_id,
                      phase_score
                    FROM pa_scores
                  ) AS combined
                  GROUP BY
                    email,
                    phase_id
                ), leave_summary AS (
  SELECT
    LOWER(TRIM(s."Navgurukul_Email")) AS email,
    SUM(COALESCE(CAST(NULLIF(TRIM(CAST(al."Days" AS TEXT)), '') AS NUMERIC), 0)) AS leave_days
  FROM PUBLIC.tbl_ghar_apply_leave AS al
  INNER JOIN PUBLIC.tbl_ghar_add_student AS s
    ON al."Student1" = CAST(s."ID" AS TEXT)
  INNER JOIN PUBLIC.tbl_ghar_leave_type AS lt
    ON al."Leave_Type" = CAST(lt."ID" AS TEXT)
  WHERE
    NOT s."Navgurukul_Email" IS NULL
    AND TRIM(s."Navgurukul_Email") <> ''
    AND al."Leave_status" IS NOT NULL
  GROUP BY
    LOWER(TRIM(s."Navgurukul_Email"))
), attendance_summary AS (
  SELECT
    es.email,
    GREATEST(
      CAST((CURRENT_DATE - es.joining_date) - COALESCE(ls.leave_days, 0) AS INT),
      0
    ) AS total_present_days
  FROM eligible_students AS es
  LEFT JOIN leave_summary AS ls
    ON ls.email = es.email
  WHERE
    NOT es.joining_date IS NULL
)
                SELECT
                  es.campus_id,
                  es.campus_name,
                  es.student_school AS school_name,
                  es.student_name,
                  es.student_status,
                  es.email,
                  es.joining_date,
                  CASE
                    WHEN NOT es.joining_date IS NULL
                    THEN CURRENT_DATE - es.joining_date
                    ELSE NULL
                  END AS time_on_campus_days,
                  COALESCE(ats.total_present_days, 0) AS total_present_days,
                  lwg.write_grade,
                  lsg.speak_grade,
                  CASE
                    WHEN sls.last_submitted_phase IS NULL
                    THEN 'Phase 1'
                    WHEN sls.last_submitted_phase >= 7
                    THEN 'Phase 7'
                    ELSE CONCAT('Phase ', sls.last_submitted_phase + 1)
                  END AS current_phase,
                  CASE
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 0 AND 30
                    THEN 'Induction'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 31 AND 35
                    THEN 'Phase 1'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 36 AND 48
                    THEN 'Phase 2'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 49 AND 78
                    THEN 'Converting Flowcharts to JS'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 79 AND 108
                    THEN 'Phase 2.5'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 109 AND 128
                    THEN 'Phase 3'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 129 AND 142
                    THEN 'Phase 4'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 143 AND 157
                    THEN 'Phase 5'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 158 AND 167
                    THEN 'Phase 6'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 168 AND 212
                    THEN 'React'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 213 AND 242
                    THEN 'Phase 7 Final Open-ended Project'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 243 AND 422
                    THEN 'Milestone 2'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 423 AND 512
                    THEN 'Milestone 3'
                    WHEN COALESCE(ats.total_present_days, 0) BETWEEN 513 AND 602
                    THEN 'Milestone 4'
                    ELSE 'Milestone 4++'
                  END AS expected_phase, /* ✅ NEW: expected_phase based on total_present_days */
                  MAX(CASE WHEN sps.phase_id = 1 THEN sps.phase_score END) AS phase1_score,
                  MAX(CASE WHEN sps.phase_id = 2 THEN sps.phase_score END) AS phase2_score,
                  MAX(CASE WHEN sps.phase_id = 3 THEN sps.phase_score END) AS phase3_score,
                  MAX(CASE WHEN sps.phase_id = 4 THEN sps.phase_score END) AS phase4_score,
                  MAX(CASE WHEN sps.phase_id = 5 THEN sps.phase_score END) AS phase5_score,
                  MAX(CASE WHEN sps.phase_id = 6 THEN sps.phase_score END) AS phase6_score,
                  MAX(CASE WHEN sps.phase_id = 7 THEN sps.phase_score END) AS phase7_score
                FROM eligible_students AS es
                LEFT JOIN student_latest_submitted AS sls
                  ON sls.email = es.email
                LEFT JOIN student_phase_scores AS sps
                  ON sps.email = es.email
                LEFT JOIN attendance_summary AS ats
                  ON ats.email = es.email
                LEFT JOIN latest_write_grade AS lwg
                  ON lwg.student_id = es.student_id
                LEFT JOIN latest_speak_grade AS lsg
                  ON lsg.student_id = es.student_id
                GROUP BY
                  es.campus_id,
                  es.campus_name,
                  es.student_school,
                  es.student_name,
                  es.student_status,
                  es.email,
                  es.joining_date,
                  sls.last_submitted_phase,
                  ats.total_present_days,
                  lwg.write_grade,
                  lsg.speak_grade
                ORDER BY
                  es.campus_name,
                  es.student_name,
                  es.email
              ) AS virtual_table
              LIMIT 1000
            ) AS virtual_table
            LIMIT 1000
          ) AS virtual_table
          LIMIT 1000
        ) AS virtual_table
        GROUP BY
          campus_name,
          school_name,
          student_name,
          email,
          time_on_campus_days,
          total_present_days,
          write_grade,
          speak_grade,
          current_phase,
          expected_phase,
          phase1_score,
          phase2_score,
          phase3_score,
          phase4_score,
          phase5_score,
          phase6_score,
          phase7_score,
          student_status
        LIMIT 1000
      ) AS virtual_table
      LIMIT 1000
    ) AS virtual_table
    GROUP BY
      campus_name,
      school_name,
      student_name,
      email,
      student_status,
      time_on_campus_days,
      total_present_days,
      write_grade,
      speak_grade,
      current_phase,
      expected_phase,
      phase1_score,
      phase2_score,
      phase3_score,
      phase4_score,
      phase5_score,
      phase6_score,
      phase7_score
    LIMIT 1000
  ) AS virtual_table
  LIMIT 1000
) AS virtual_table
GROUP BY
  campus_name,
  school_name,
  student_name,
  email,
  student_status,
  time_on_campus_days,
  total_present_days,
  write_grade,
  speak_grade,
  current_phase,
  expected_phase,
  phase1_score,
  phase2_score,
  phase3_score,
  phase4_score,
  phase5_score,
  phase6_score,
  phase7_score
LIMIT 1000
) AS virtual_table 
 LIMIT 1000
