-- Production dataset "Concept Explanation Summary View" (Superset export 2026-10-24), runs on MAIN.
-- columns: last_ability_to_explain_level, video_cleared_accuracy, phase_name, videos_cleared, email
WITH all_phases AS (
    SELECT
        id AS phase_id,
        phase_name
    FROM tbl_ailabls_ytfeedback_phases
),

phase_videos AS (
    SELECT
        pv.id AS video_id,
        pv.phase_id,
        pv.video_title,
        ROW_NUMBER() OVER (
            PARTITION BY pv.phase_id
            ORDER BY pv.id
        ) AS video_number
    FROM tbl_ailabls_ytfeedback_phasevideos pv
),

latest_video_evals AS (
    SELECT DISTINCT ON (
        LOWER(TRIM(ce.email)),
        pv.phase_id,
        pv.video_id
    )
        LOWER(TRIM(ce.email)) AS email,
        pv.phase_id,
        pv.video_id,
        ce.ability_to_explain_evaluation,
        ce.concept_explanation_accuracy,
        ce.created_at
    FROM phase_videos pv
    INNER JOIN tbl_ailabls_ytfeedback_phases p
        ON p.id = pv.phase_id
    INNER JOIN tbl_ailabs_ytfeedback_concept_evaluations ce
        ON (
            LOWER(TRIM(ce.page_name)) = LOWER(TRIM(pv.video_title))
            OR LOWER(TRIM(ce.page_name)) =
               LOWER(TRIM(pv.video_title || ' - ' || p.phase_name))
            OR (
                ce.project_name IS NOT NULL
                AND LOWER(TRIM(ce.project_name)) = LOWER(TRIM(p.phase_name))
                AND LOWER(TRIM(ce.page_name)) = LOWER(TRIM(pv.video_title))
            )
        )
    ORDER BY
        LOWER(TRIM(ce.email)),
        pv.phase_id,
        pv.video_id,
        ce.created_at DESC
),

all_students AS (
    SELECT DISTINCT email
    FROM latest_video_evals
),

phase_metrics AS (
    SELECT
        s.email,
        ap.phase_id,
        ap.phase_name,

        COUNT(pv.video_id) AS total_videos_in_phase,

        COUNT(lve.video_id) AS evaluated_videos,

        COUNT(*) FILTER (
            WHERE NULLIF(
                REGEXP_REPLACE(
                    COALESCE(lve.concept_explanation_accuracy,''),
                    '%',
                    '',
                    'g'
                ),
                ''
            )::numeric > 80
        ) AS videos_cleared,

        (
            SELECT l2.ability_to_explain_evaluation
            FROM latest_video_evals l2
            WHERE l2.email = s.email
              AND l2.phase_id = ap.phase_id
            ORDER BY l2.created_at DESC
            LIMIT 1
        ) AS last_ability_to_explain_level

    FROM all_students s

    CROSS JOIN all_phases ap

    LEFT JOIN phase_videos pv
        ON pv.phase_id = ap.phase_id

    LEFT JOIN latest_video_evals lve
        ON lve.email = s.email
       AND lve.phase_id = ap.phase_id
       AND lve.video_id = pv.video_id

    GROUP BY
        s.email,
        ap.phase_id,
        ap.phase_name
)

SELECT
    email,
    phase_name,

    CASE
        WHEN evaluated_videos = 0 THEN '-'
        WHEN videos_cleared = 0 THEN '0'
        ELSE videos_cleared::text
    END AS videos_cleared,

    CASE
        WHEN evaluated_videos = 0 THEN '-'
        ELSE ROUND(
            videos_cleared::numeric * 100 / evaluated_videos
        )::text || '%'
    END AS video_cleared_accuracy,

    COALESCE(last_ability_to_explain_level, '—')
        AS last_ability_to_explain_level

FROM phase_metrics

ORDER BY
    email,
    phase_id
