-- Production dataset "Weekly Campus Wise Summary" (Superset export 2026-10-24), runs on MAIN.
-- columns: % Learning per Active Student, Project Analyzer Projects, Youtube Concept, Youtube Project, Total Learnings, week, active_students, campus_name
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

-- Total active/eligible students per campus (overall headcount, not week-specific)
campus_student_counts AS (
    SELECT
        campus_id,
        campus_name,
        COUNT(DISTINCT email) AS active_students
    FROM eligible_students
    GROUP BY campus_id, campus_name
),

-- 1. YouTube project video / project-explanation evaluations
yt_project_activity AS (
    SELECT
        es.campus_id,
        es.campus_name,
        es.email,
        DATE_TRUNC('week', ype.created_at)::date AS week_start
    FROM eligible_students es
    JOIN public.tbl_ailabs_ytfeedback_project_evaluation ype
        ON LOWER(TRIM(ype.email)) = es.email
    JOIN public.tbl_ailabls_ytfeedback_phases ph
        ON LOWER(TRIM(ph.phase_name)) = LOWER(TRIM(ype.project_name))
    WHERE ype.project_explanation_evaluationjson IS NOT NULL
        AND TRIM(ype.project_explanation_evaluationjson) <> ''
),

-- 2. Project Analyzer project submissions (completed only = "done")
pa_project_activity AS (
    SELECT
        es.campus_id,
        es.campus_name,
        es.email,
        DATE_TRUNC('week', COALESCE(pp."updatedAt", pp."createdAt"))::date AS week_start
    FROM eligible_students es
    JOIN public.tbl_ailabs_projectanalyzer_users_af pu
        ON LOWER(TRIM(pu.email)) = es.email
    JOIN public.tbl_ailabs_projectanalyzer_projects_af pp
        ON pp."userId" = pu._id
    WHERE pp.phase ~ '^phase[0-9]+$'
        AND LOWER(TRIM(COALESCE(pp.status, ''))) = 'completed'
        AND pp."finalFeedback" IS NOT NULL
),

-- 3. YouTube concept (video) explanation evaluations
yt_concept_activity AS (
    SELECT
        es.campus_id,
        es.campus_name,
        es.email,
        DATE_TRUNC('week', ce.created_at)::date AS week_start
    FROM eligible_students es
    JOIN public.tbl_ailabs_ytfeedback_concept_evaluations ce
        ON LOWER(TRIM(ce.email)) = es.email
    WHERE ce.ability_to_explain_evaluation IS NOT NULL
),

all_activity AS (
    SELECT campus_id, campus_name, email, week_start, 'yt_project' AS source FROM yt_project_activity
    UNION ALL
    SELECT campus_id, campus_name, email, week_start, 'pa_project' AS source FROM pa_project_activity
    UNION ALL
    SELECT campus_id, campus_name, email, week_start, 'yt_concept' AS source FROM yt_concept_activity
),

weekly_summary AS (
    SELECT
        aa.campus_name AS campus_name,
        aa.week_start   AS week,
        csc.active_students AS active_students,
        SUM(CASE WHEN aa.source = 'yt_project' THEN 1 ELSE 0 END) AS "Youtube Project",
        SUM(CASE WHEN aa.source = 'yt_concept' THEN 1 ELSE 0 END) AS "Youtube Concept",
        SUM(CASE WHEN aa.source = 'pa_project' THEN 1 ELSE 0 END) AS "Project Analyzer Projects"
    FROM all_activity aa
    JOIN campus_student_counts csc
        ON csc.campus_id = aa.campus_id
    GROUP BY aa.campus_name, aa.week_start, csc.active_students
)

SELECT
    campus_name AS campus_name,
    week        AS week,
    active_students AS active_students,
    ("Youtube Project" + "Youtube Concept" + "Project Analyzer Projects") AS "Total Learnings",
    ROUND(
        ("Youtube Project" + "Youtube Concept" + "Project Analyzer Projects")::numeric
        / NULLIF(active_students, 0) * 100,
    2) AS "% Learning per Active Student",
    "Youtube Project"           AS "Youtube Project",
    "Youtube Concept"           AS "Youtube Concept",
    "Project Analyzer Projects" AS "Project Analyzer Projects"
FROM weekly_summary
ORDER BY week DESC, "% Learning per Active Student" ASC
