-- Production dataset "Campus Phase Progress" (Superset export 2026-10-24), runs on MAIN.
-- columns: phase1, phase2, phase3, phase4, phase5, phase6, phase7, total_students, campus_name, avg_speak_grade, avg_write_grade, school_name
SELECT campus_name AS campus_name, school_name AS school_name, total_students AS total_students, avg_write_grade AS avg_write_grade, avg_speak_grade AS avg_speak_grade, phase1 AS phase1, phase2 AS phase2, phase3 AS phase3, phase4 AS phase4, phase5 AS phase5, phase6 AS phase6, phase7 AS phase7 
FROM (SELECT
    campus_name     AS campus_name,
    school_name     AS school_name,
    total_students  AS total_students,
    avg_write_grade AS avg_write_grade,
    avg_speak_grade AS avg_speak_grade,
    phase1          AS phase1,
    phase2          AS phase2,
    phase3          AS phase3,
    phase4          AS phase4,
    phase5          AS phase5,
    phase6          AS phase6,
    phase7          AS phase7
FROM (
    SELECT
        campus_name, school_name, total_students,
        avg_write_grade, avg_speak_grade,
        phase1, phase2, phase3, phase4, phase5, phase6, phase7
    FROM (
        WITH eligible_students AS (
            SELECT
                c."ID"::text                      AS campus_id,
                TRIM(c."Campus_Name")             AS campus_name,
                LOWER(TRIM(s."Navgurukul_Email")) AS email,
                s."ID"::text                      AS student_id,
                TRIM(s."Select_School1")          AS student_school
            FROM public.tbl_ghar_add_student s
            JOIN public.tbl_ghar_create_campus c
                ON c."ID"::text = s."Select_Campus"::text
            WHERE (s."Status" = 'Active' OR s."Status" = 'Intern (In Campus)')
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
        campus_schools AS (
            SELECT
                asc_."Campuses"::text     AS campus_id,
                TRIM(asc_."Schools_Name") AS school_name
            FROM public.tbl_ghar_assign_school_to_campus asc_
            WHERE TRIM(asc_."Schools_Name") = 'School of Programming'
                OR TRIM(asc_."Schools_Name") IN (
                    'Bachelor of Computer Applications- Eternal 24-27',
                    'Bachelor of Computer Applications- Eternal 25-28',
                    'Bachelor of Computer Applications- Eternal 26-29'
                )
        ),
        yt_phase_timestamps AS (
            SELECT
                es.campus_id, es.campus_name, es.email,
                ph.id               AS phase_id,
                MAX(ype.created_at) AS last_submission
            FROM eligible_students es
            JOIN public.tbl_ailabs_ytfeedback_project_evaluation ype
                ON LOWER(TRIM(ype.email)) = es.email
            JOIN public.tbl_ailabls_ytfeedback_phases ph
                ON LOWER(TRIM(ph.phase_name)) = LOWER(TRIM(ype.project_name))
            GROUP BY es.campus_id, es.campus_name, es.email, ph.id
        ),
        pa_phase_timestamps AS (
            SELECT
                es.campus_id, es.campus_name, es.email,
                regexp_replace(pp.phase, '[^0-9]', '', 'g')::int AS phase_id,
                MAX(COALESCE(pp."updatedAt", pp."createdAt"))     AS last_submission
            FROM eligible_students es
            JOIN public.tbl_ailabs_projectanalyzer_users_af pu
                ON LOWER(TRIM(pu.email)) = es.email
            JOIN public.tbl_ailabs_projectanalyzer_projects_af pp
                ON pp."userId" = pu._id
            WHERE pp.phase ~ '^phase[0-9]+$'
            GROUP BY es.campus_id, es.campus_name, es.email, pp.phase
        ),
        all_phase_timestamps AS (
            SELECT * FROM yt_phase_timestamps
            UNION ALL
            SELECT * FROM pa_phase_timestamps
        ),
        student_latest_phase AS (
            SELECT
                es.campus_id, es.campus_name, es.email,
                es.student_school,
                CASE
                    WHEN mp.max_phase IS NULL THEN 1
                    WHEN mp.max_phase >= 7    THEN 7
                    ELSE mp.max_phase + 1
                END AS phase_id
            FROM eligible_students es
            LEFT JOIN (
                SELECT email, MAX(phase_id) AS max_phase
                FROM all_phase_timestamps
                GROUP BY email
            ) mp ON mp.email = es.email
        ),
        campus_school_totals AS (
            SELECT
                es.campus_id,
                es.campus_name,
                cs.school_name,
                COUNT(DISTINCT es.email) AS total_students
            FROM eligible_students es
            JOIN campus_schools cs
                ON cs.campus_id = es.campus_id
                AND LOWER(TRIM(cs.school_name)) = LOWER(TRIM(es.student_school))
            GROUP BY es.campus_id, es.campus_name, cs.school_name
        ),
        -- FIX: removed student_school from GROUP BY, count per campus+school+phase only
        campus_school_phase_counts AS (
            SELECT
                slp.campus_id,
                cs.school_name,
                slp.phase_id,
                COUNT(DISTINCT slp.email) AS student_count
            FROM student_latest_phase slp
            JOIN campus_schools cs
                ON cs.campus_id = slp.campus_id
                AND LOWER(TRIM(cs.school_name)) = LOWER(TRIM(slp.student_school))
            GROUP BY slp.campus_id, cs.school_name, slp.phase_id
        ),
        latest_write_grade AS (
            SELECT DISTINCT ON ("Name")
                "Name"          AS student_id,
                "Select_Campus" AS campus_id,
                "Grade"         AS grade
            FROM public."tbl_ghar_Write_Improve_Data"
            ORDER BY "Name", "Completion_Date" DESC NULLS LAST
        ),
        latest_speak_grade AS (
            SELECT DISTINCT ON ("Name")
                "Name"          AS student_id,
                "Select_Campus" AS campus_id,
                "Grade"         AS grade
            FROM public."tbl_ghar_Speak_Improve_Data"
            ORDER BY "Name", "Completion_Date" DESC NULLS LAST
        ),
        write_grade_numeric AS (
            SELECT
                es.campus_id,
                cs.school_name,
                CASE lwg.grade
                    WHEN 'Absent in Exam' THEN 0
                    WHEN '-A1'            THEN 1
                    WHEN 'A1'             THEN 2
                    WHEN 'A2'             THEN 3
                    WHEN 'B1'             THEN 4
                    WHEN 'B2'             THEN 5
                    WHEN 'C1'             THEN 6
                    WHEN 'C2'             THEN 7
                END AS grade_num
            FROM eligible_students es
            JOIN campus_schools cs
                ON cs.campus_id = es.campus_id
                AND LOWER(TRIM(cs.school_name)) = LOWER(TRIM(es.student_school))
            JOIN latest_write_grade lwg ON lwg.student_id = es.student_id
            WHERE lwg.grade IS NOT NULL
        ),
        speak_grade_numeric AS (
            SELECT
                es.campus_id,
                cs.school_name,
                CASE lsg.grade
                    WHEN 'Absent in Exam' THEN 0
                    WHEN '-A1'            THEN 1
                    WHEN 'A1'             THEN 2
                    WHEN 'A2'             THEN 3
                    WHEN 'B1'             THEN 4
                    WHEN 'B2'             THEN 5
                    WHEN 'C1'             THEN 6
                    WHEN 'C2'             THEN 7
                END AS grade_num
            FROM eligible_students es
            JOIN campus_schools cs
                ON cs.campus_id = es.campus_id
                AND LOWER(TRIM(cs.school_name)) = LOWER(TRIM(es.student_school))
            JOIN latest_speak_grade lsg ON lsg.student_id = es.student_id
            WHERE lsg.grade IS NOT NULL
        ),
        campus_write_grade AS (
            SELECT
                campus_id, school_name,
                CASE ROUND(AVG(grade_num))
                    WHEN 0 THEN 'Absent in Exam'
                    WHEN 1 THEN '-A1'
                    WHEN 2 THEN 'A1'
                    WHEN 3 THEN 'A2'
                    WHEN 4 THEN 'B1'
                    WHEN 5 THEN 'B2'
                    WHEN 6 THEN 'C1'
                    WHEN 7 THEN 'C2'
                END AS avg_write_grade
            FROM write_grade_numeric
            GROUP BY campus_id, school_name
        ),
        campus_speak_grade AS (
            SELECT
                campus_id, school_name,
                CASE ROUND(AVG(grade_num))
                    WHEN 0 THEN 'Absent in Exam'
                    WHEN 1 THEN '-A1'
                    WHEN 2 THEN 'A1'
                    WHEN 3 THEN 'A2'
                    WHEN 4 THEN 'B1'
                    WHEN 5 THEN 'B2'
                    WHEN 6 THEN 'C1'
                    WHEN 7 THEN 'C2'
                END AS avg_speak_grade
            FROM speak_grade_numeric
            GROUP BY campus_id, school_name
        )
        SELECT
            cst.campus_id,
            cst.campus_name,
            cst.school_name,
            cst.total_students,
            COALESCE(MAX(CASE WHEN cspc.phase_id = 1 THEN cspc.student_count END), 0) AS phase1,
            COALESCE(MAX(CASE WHEN cspc.phase_id = 2 THEN cspc.student_count END), 0) AS phase2,
            COALESCE(MAX(CASE WHEN cspc.phase_id = 3 THEN cspc.student_count END), 0) AS phase3,
            COALESCE(MAX(CASE WHEN cspc.phase_id = 4 THEN cspc.student_count END), 0) AS phase4,
            COALESCE(MAX(CASE WHEN cspc.phase_id = 5 THEN cspc.student_count END), 0) AS phase5,
            COALESCE(MAX(CASE WHEN cspc.phase_id = 6 THEN cspc.student_count END), 0) AS phase6,
            COALESCE(MAX(CASE WHEN cspc.phase_id = 7 THEN cspc.student_count END), 0) AS phase7,
            cwg.avg_write_grade,
            csg.avg_speak_grade
        FROM campus_school_totals cst
        LEFT JOIN campus_school_phase_counts cspc
            ON cspc.campus_id  = cst.campus_id
            AND cspc.school_name = cst.school_name
        LEFT JOIN campus_write_grade cwg
            ON cwg.campus_id   = cst.campus_id
            AND cwg.school_name  = cst.school_name
        -- FIX: added campus_id to speak grade join
        LEFT JOIN campus_speak_grade csg
            ON csg.campus_id   = cst.campus_id
            AND csg.school_name  = cst.school_name
        GROUP BY
            cst.campus_id, cst.campus_name, cst.school_name,
            cst.total_students, cwg.avg_write_grade, csg.avg_speak_grade
        ORDER BY cst.campus_name, cst.school_name
    ) AS virtual_table
    LIMIT 1000
) AS virtual_table
LIMIT 1000
) AS virtual_table 
 LIMIT 1000
