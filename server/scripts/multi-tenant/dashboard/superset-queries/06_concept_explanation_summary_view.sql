-- ==================================================================================
-- Dashboard component: Concept Explanation Summary View
-- Database: TEST (test_ghar_central_db). Columns: email, phase_name, videos_cleared, video_cleared_accuracy, last_ability_to_explain_level
-- Per student (anyone with a concept-video evaluation) and phase: videos cleared (accuracy > 80, latest
-- evaluation per video), share of evaluated videos cleared, latest ability-to-explain level.
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
concept_videos AS (       -- concept videos of each phase, numbered within the phase
  SELECT va.id AS video_uuid, np.phase_no, np.phase_name, va.title AS video_title,
         ROW_NUMBER() OVER (PARTITION BY va.phase_id ORDER BY va.sort_order, va.created_at, va.title) AS video_number
    FROM public.video_assignments va
    JOIN nav_phases np ON np.phase_uuid = va.phase_id
   WHERE va.video_type = 'concept' AND va.is_active
),
concept_evals AS (        -- concept-video evaluations, matched to their video by the video link
  SELECT ce.id, LOWER(TRIM(ce.email)) AS email, v.phase_no, v.phase_name,
         v.video_uuid, v.video_number, v.video_title,
         NULLIF(REGEXP_REPLACE(COALESCE(ce.concept_explanation_accuracy::text, ''), '[^0-9.]', '', 'g'), '')::numeric AS accuracy,
         ce.ability_to_explain_evaluation, ce.ability_to_explain_feedback, ce.concept_explanation_feedback,
         ce.created_at
    FROM public.tbl_ailabs_ytfeedback_concept_evaluations ce
    JOIN scope s ON s.institution_id = ce.institution_id
    LEFT JOIN LATERAL (                                 -- rows saved before the links existed:
      SELECT cv.video_uuid                              -- match the video title, as production
        FROM concept_videos cv
       WHERE ce.video_assignment_id IS NULL
         AND (LOWER(TRIM(ce.page_name)) = LOWER(TRIM(cv.video_title))
              OR LOWER(TRIM(ce.page_name)) = LOWER(TRIM(cv.video_title || ' - ' || cv.phase_name)))
       ORDER BY (LOWER(TRIM(cv.phase_name)) = LOWER(TRIM(ce.project_name))) DESC, cv.phase_no
       LIMIT 1) fb ON TRUE
    JOIN concept_videos v ON v.video_uuid = COALESCE(ce.video_assignment_id, fb.video_uuid)
),
latest_video_eval AS (
  SELECT DISTINCT ON (email, video_uuid) email, phase_no, video_uuid, accuracy, ability_to_explain_evaluation, created_at
    FROM concept_evals
   ORDER BY email, video_uuid, created_at DESC
),
phase_metrics AS (
  SELECT s.email, ph.phase_no, ph.phase_name,
         COUNT(l.video_uuid)                     AS evaluated_videos,
         COUNT(*) FILTER (WHERE l.accuracy > 80) AS videos_cleared,
         (SELECT l2.ability_to_explain_evaluation
            FROM latest_video_eval l2
           WHERE l2.email = s.email AND l2.phase_no = ph.phase_no
           ORDER BY l2.created_at DESC LIMIT 1)  AS last_level
    FROM (SELECT DISTINCT email FROM latest_video_eval) s
   CROSS JOIN nav_phases ph
    LEFT JOIN latest_video_eval l ON l.email = s.email AND l.phase_no = ph.phase_no
   GROUP BY s.email, ph.phase_no, ph.phase_name
)
SELECT email,
       phase_name,
       CASE WHEN evaluated_videos = 0 THEN '-' ELSE videos_cleared::text END AS videos_cleared,
       CASE WHEN evaluated_videos = 0 THEN '-'
            ELSE ROUND(videos_cleared::numeric * 100 / evaluated_videos)::text || '%' END AS video_cleared_accuracy,
       COALESCE(last_level, '—') AS last_ability_to_explain_level
  FROM phase_metrics
 ORDER BY email, phase_no
