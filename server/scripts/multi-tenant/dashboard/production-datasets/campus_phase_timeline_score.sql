-- Production dataset "Campus Phase Timeline & Score" (Superset export 2026-10-24), runs on MAIN.
-- columns: avg_time_days, avg_score, student_count, campus_name, phase_name, school_name
SELECT campus_name AS campus_name, school_name AS school_name, phase_name AS phase_name, student_count AS student_count, avg_time_days AS avg_time_days, avg_score AS avg_score 
FROM (SELECT
    campus_name   AS campus_name,
    school_name   AS school_name,
    phase_name    AS phase_name,
    student_count AS student_count,
    avg_time_days AS avg_time_days,
    avg_score     AS avg_score
FROM (
    SELECT
        campus_name, school_name, phase_name, student_count, avg_time_days, avg_score
    FROM (
        WITH eligible_students AS (
            SELECT
                c."ID"::text                      AS campus_id,
                TRIM(c."Campus_Name")             AS campus_name,
                LOWER(TRIM(s."Navgurukul_Email")) AS email,
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
        yt_phase_dates AS (
            SELECT
                es.campus_id, es.campus_name, es.email, es.student_school,
                ph.id               AS phase_id,
                MIN(ype.created_at) AS first_submission
            FROM eligible_students es
            JOIN public.tbl_ailabs_ytfeedback_project_evaluation ype
                ON LOWER(TRIM(ype.email)) = es.email
            JOIN public.tbl_ailabls_ytfeedback_phases ph
                ON LOWER(TRIM(ph.phase_name)) = LOWER(TRIM(ype.project_name))
            GROUP BY es.campus_id, es.campus_name, es.email, es.student_school, ph.id
        ),
        pa_phase_dates AS (
            SELECT
                es.campus_id, es.campus_name, es.email, es.student_school,
                (regexp_match(pp.phase, '^phase([0-9]+)$'))[1]::int AS phase_id,
                MIN(COALESCE(pp."updatedAt", pp."createdAt"))        AS first_submission
            FROM eligible_students es
            JOIN public.tbl_ailabs_projectanalyzer_users_af pu
                ON LOWER(TRIM(pu.email)) = es.email
            JOIN public.tbl_ailabs_projectanalyzer_projects_af pp
                ON pp."userId" = pu._id
            WHERE pp.phase ~ '^phase[0-9]+$' and pp.status= 'completed'
            GROUP BY es.campus_id, es.campus_name, es.email, es.student_school, pp.phase
        ),
        all_phase_dates AS (
            SELECT * FROM yt_phase_dates
            UNION ALL
            SELECT * FROM pa_phase_dates
        ),
        student_phase_first AS (
            SELECT
                campus_id, campus_name, email, student_school, phase_id,
                MIN(first_submission) AS first_submission
            FROM all_phase_dates
            GROUP BY campus_id, campus_name, email, student_school, phase_id
        ),
        student_phase_gaps AS (
            SELECT
                spf.campus_id, spf.campus_name, spf.email,
                spf.student_school, spf.phase_id,
                CASE
                    WHEN spf.phase_id = 1 THEN 1
                    WHEN prev.first_submission IS NULL THEN NULL
                    ELSE GREATEST(1, CEIL(
                        EXTRACT(EPOCH FROM spf.first_submission - prev.first_submission) / 86400
                    ))
                END AS days_taken
            FROM student_phase_first spf
            LEFT JOIN student_phase_first prev
                ON prev.email     = spf.email
                AND prev.phase_id = spf.phase_id - 1
        ),
        weightages AS (
            SELECT
                (regexp_match(phaseid::text, '(\d+)'))[1]::int AS phase_id,
                trim(regexp_replace(regexp_replace(lower(trim(parametername)),
                    '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'))  AS norm_fullname,
                trim(regexp_replace(regexp_replace(lower(trim(coalesce(shortparametername, parametername))),
                    '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'))  AS norm_shortname,
                condensedweightage
            FROM public.tbl_ailabs_phasewise_parameter_weightages
            WHERE condensedweightage IS NOT NULL
        ),
        latest_yt_eval AS (
            SELECT DISTINCT ON (LOWER(TRIM(pe.email)), ph.id)
                LOWER(TRIM(pe.email)) AS email,
                ph.id                 AS phase_id,
                pe.project_explanation_evaluationjson
            FROM tbl_ailabls_ytfeedback_phases ph
            INNER JOIN tbl_ailabs_ytfeedback_project_evaluation pe
                ON LOWER(TRIM(pe.project_name)) = LOWER(TRIM(ph.phase_name))
            WHERE pe.project_explanation_evaluationjson IS NOT NULL
                AND TRIM(pe.project_explanation_evaluationjson) <> ''
            ORDER BY LOWER(TRIM(pe.email)), ph.id, pe.created_at DESC
        ),
        latest_pa_eval AS (
            SELECT DISTINCT ON (LOWER(TRIM(pu.email)), phase_num)
                LOWER(TRIM(pu.email)) AS email,
                phase_num             AS phase_id,
                pp."finalFeedback"
            FROM (
                SELECT pp.*,
                    (regexp_match(pp.phase, '^phase([0-9]+)$'))[1]::int AS phase_num
                FROM public.tbl_ailabs_projectanalyzer_projects_af pp
                WHERE LOWER(TRIM(COALESCE(pp.status, ''))) = 'completed'
                    AND pp."finalFeedback" IS NOT NULL
                    AND pp.phase ~ '^phase[0-9]+$'
            ) pp
            INNER JOIN public.tbl_ailabs_projectanalyzer_users_af pu ON pu._id = pp."userId"
            ORDER BY LOWER(TRIM(pu.email)), phase_num,
                COALESCE(pp."updatedAt", pp."createdAt") DESC NULLS LAST
        ),
        yt_scores AS (
            SELECT
                es.campus_id, es.student_school, lye.email, lye.phase_id,
                round(sum(round(CASE lower(trim(param.value ->> 'level'))
                    WHEN 'beginner'     THEN (1.0/4) * w.condensedweightage
                    WHEN 'intermediate' THEN (2.0/4) * w.condensedweightage
                    WHEN 'advanced'     THEN (3.0/4) * w.condensedweightage
                    WHEN 'expert'       THEN (4.0/4) * w.condensedweightage
                END::numeric, 2))::numeric, 2) AS phase_score
            FROM latest_yt_eval lye
            JOIN eligible_students es ON es.email = lye.email
            CROSS JOIN LATERAL jsonb_array_elements(
                lye.project_explanation_evaluationjson::jsonb -> 'parameters'
            ) AS param
            JOIN LATERAL (
                SELECT condensedweightage FROM weightages w
                WHERE w.phase_id = lye.phase_id
                    AND (
                        w.norm_fullname  = trim(regexp_replace(regexp_replace(lower(param.value ->> 'name'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g'))
                        OR w.norm_shortname = trim(regexp_replace(regexp_replace(lower(param.value ->> 'name'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g'))
                        OR trim(regexp_replace(regexp_replace(lower(param.value ->> 'name'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g')) LIKE '%'||w.norm_fullname||'%'
                        OR w.norm_fullname  LIKE '%'||trim(regexp_replace(regexp_replace(lower(param.value ->> 'name'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g'))||'%'
                        OR trim(regexp_replace(regexp_replace(lower(param.value ->> 'name'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g')) LIKE '%'||w.norm_shortname||'%'
                        OR w.norm_shortname LIKE '%'||trim(regexp_replace(regexp_replace(lower(param.value ->> 'name'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g'))||'%'
                    )
                ORDER BY
                    (w.norm_fullname  = trim(regexp_replace(regexp_replace(lower(param.value ->> 'name'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g')))::int DESC,
                    (w.norm_shortname = trim(regexp_replace(regexp_replace(lower(param.value ->> 'name'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g')))::int DESC
                LIMIT 1
            ) w ON TRUE
            WHERE lower(trim(param.value ->> 'level')) IN ('beginner','intermediate','advanced','expert')
            GROUP BY es.campus_id, es.student_school, lye.email, lye.phase_id
        ),
        pa_scores AS (
            SELECT
                es.campus_id, es.student_school, lpe.email, lpe.phase_id,
                round(sum(round(CASE lower(trim(crit.value ->> 'assignedLevel'))
                    WHEN 'beginner'     THEN (1.0/4) * w.condensedweightage
                    WHEN 'intermediate' THEN (2.0/4) * w.condensedweightage
                    WHEN 'advanced'     THEN (3.0/4) * w.condensedweightage
                    WHEN 'expert'       THEN (4.0/4) * w.condensedweightage
                END::numeric, 2))::numeric, 2) AS phase_score
            FROM latest_pa_eval lpe
            JOIN eligible_students es ON es.email = lpe.email
            CROSS JOIN LATERAL jsonb_array_elements(
                lpe."finalFeedback"::jsonb -> 'criterionWiseEvaluation'
            ) AS crit
            JOIN LATERAL (
                SELECT condensedweightage FROM weightages w
                WHERE w.phase_id = lpe.phase_id
                    AND (
                        w.norm_fullname  = trim(regexp_replace(regexp_replace(lower(crit.value ->> 'parameter'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g'))
                        OR w.norm_shortname = trim(regexp_replace(regexp_replace(lower(crit.value ->> 'parameter'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g'))
                        OR trim(regexp_replace(regexp_replace(lower(crit.value ->> 'parameter'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g')) LIKE '%'||w.norm_fullname||'%'
                        OR w.norm_fullname  LIKE '%'||trim(regexp_replace(regexp_replace(lower(crit.value ->> 'parameter'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g'))||'%'
                        OR trim(regexp_replace(regexp_replace(lower(crit.value ->> 'parameter'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g')) LIKE '%'||w.norm_shortname||'%'
                        OR w.norm_shortname LIKE '%'||trim(regexp_replace(regexp_replace(lower(crit.value ->> 'parameter'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g'))||'%'
                    )
                ORDER BY
                    (w.norm_fullname  = trim(regexp_replace(regexp_replace(lower(crit.value ->> 'parameter'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g')))::int DESC,
                    (w.norm_shortname = trim(regexp_replace(regexp_replace(lower(crit.value ->> 'parameter'),'[^a-z0-9 ]',' ','g'),'\s+',' ','g')))::int DESC
                LIMIT 1
            ) w ON TRUE
            WHERE lower(trim(crit.value ->> 'assignedLevel')) IN ('beginner','intermediate','advanced','expert')
            GROUP BY es.campus_id, es.student_school, lpe.email, lpe.phase_id
        ),
        student_phase_scores AS (
            SELECT
                campus_id, student_school, email, phase_id,
                round(sum(phase_score)::numeric, 2) AS phase_score
            FROM (
                SELECT campus_id, student_school, email, phase_id, phase_score FROM yt_scores
                UNION ALL
                SELECT campus_id, student_school, email, phase_id, phase_score FROM pa_scores
            ) combined
            GROUP BY campus_id, student_school, email, phase_id
        ),
        campus_phase_scores AS (
            SELECT
                campus_id, student_school, phase_id,
                ROUND(AVG(phase_score)::numeric, 2) AS avg_score
            FROM student_phase_scores
            GROUP BY campus_id, student_school, phase_id
        ),
        campus_phase_timeline AS (
            SELECT
                campus_id, campus_name, student_school, phase_id,
                ROUND(AVG(days_taken)::numeric, 1) AS avg_time_days,
                COUNT(DISTINCT email)              AS student_count
            FROM student_phase_gaps
            GROUP BY campus_id, campus_name, student_school, phase_id
        )
        SELECT
            cpt.campus_id,
            cpt.campus_name,
            cpt.student_school             AS school_name,
            cpt.phase_id,
            CONCAT('Phase ', cpt.phase_id) AS phase_name,
            cpt.avg_time_days,
            cps.avg_score,
            cpt.student_count
        FROM campus_phase_timeline cpt
        LEFT JOIN campus_phase_scores cps
            ON cps.campus_id      = cpt.campus_id
            AND cps.student_school = cpt.student_school
            AND cps.phase_id       = cpt.phase_id
        ORDER BY cpt.campus_name, cpt.student_school, cpt.phase_id
    ) AS virtual_table
    LIMIT 1000
) AS virtual_table
LIMIT 1000
) AS virtual_table 
 LIMIT 1000
