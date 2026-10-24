/**
 * Links a freshly stored evaluation to the tenant model:
 * institution, program, phase, video assignment, rubric and prompt templates.
 * Uses the same name-based resolution as the migration (including old phase
 * names via legacy_phase_name_map), so new rows look like the backfilled ones.
 * Never throws: a failure here must not lose the student's evaluation.
 */
import { pgPool } from '../db.js';

const TABLES = {
  concept: 'tbl_ailabs_ytfeedback_concept_evaluations',
  project: 'tbl_ailabs_ytfeedback_project_evaluation',
  custom: 'tbl_ailabs_ytfeedback_custom_evaluations',
};

export async function tagEvaluation({ videoType, id, institutionId, phaseName, videoTitle, model, videoAssignmentId }) {
  const table = TABLES[videoType];
  if (!table || !id || !institutionId) return;
  try {
    let link = null;
    const linkCols = `ph.id AS phase_id, ph.program_id, va.id AS va_id, va.rubric_id, va.ability_rubric_id,
                      va.accuracy_prompt_id, va.ability_prompt_id, va.project_prompt_id`;
    if (videoType !== 'custom' && videoAssignmentId) {
      // New clients tell us exactly which video was evaluated.
      const r = await pgPool.query(
        `SELECT ${linkCols} FROM video_assignments va
           JOIN phases ph ON ph.id = va.phase_id JOIN programs p ON p.id = ph.program_id
          WHERE va.id::text = $1 AND p.institution_id = $2 AND va.video_type = $3`,
        [String(videoAssignmentId), institutionId, videoType]);
      link = r.rows[0] || null;
    }
    if (!link && videoType !== 'custom' && phaseName) {
      const r = await pgPool.query(
        `SELECT ph.id AS phase_id, ph.program_id, va.id AS va_id,
                va.rubric_id, va.ability_rubric_id,
                va.accuracy_prompt_id, va.ability_prompt_id, va.project_prompt_id
           FROM phases ph
           JOIN programs p ON p.id = ph.program_id
           LEFT JOIN video_assignments va
                  ON va.phase_id = ph.id AND va.video_type = $3
                 AND ($3 = 'project' OR va.title = $4)
          WHERE p.institution_id = $1
            AND (ph.name = $2 OR ph.id = (SELECT phase_id FROM legacy_phase_name_map WHERE old_name = $2))
          ORDER BY (ph.name = $2) DESC
          LIMIT 1`,
        [institutionId, phaseName, videoType, videoTitle || '']);
      link = r.rows[0] || null;
    }

    let rubricId = null;
    let promptIds = null;
    if (videoType === 'concept' && link?.va_id) {
      rubricId = link.ability_rubric_id;
      promptIds = { accuracy: link.accuracy_prompt_id, ability_to_explain: link.ability_prompt_id };
    } else if (videoType === 'project' && link?.va_id) {
      rubricId = link.rubric_id;
      promptIds = { project: link.project_prompt_id };
    } else if (videoType === 'custom') {
      const r = await pgPool.query(
        `SELECT id FROM prompt_templates
          WHERE kind = 'custom' AND is_active AND (institution_id = $1 OR institution_id IS NULL)
          ORDER BY institution_id NULLS LAST, version DESC LIMIT 1`, [institutionId]);
      promptIds = r.rows[0] ? { custom: r.rows[0].id } : null;
    }

    // Record the exact rubric/prompt versions used, so results stay explainable after edits.
    const versions = await pgPool.query(
      `SELECT 'rubric' AS t, id::text, version FROM rubrics WHERE id = $1
       UNION ALL SELECT 'prompt', id::text, version FROM prompt_templates WHERE id::text = ANY($2)`,
      [rubricId, Object.values(promptIds || {}).filter(Boolean).map(String)]);
    const rubricVersion = versions.rows.find((v) => v.t === 'rubric')?.version ?? null;
    const promptVersions = Object.fromEntries(Object.entries(promptIds || {}).map(([k, pid]) =>
      [k, versions.rows.find((v) => v.t === 'prompt' && v.id === String(pid))?.version ?? null]));

    await pgPool.query(
      `UPDATE ${table} SET
          institution_id = $2, program_id = $3, phase_id = $4, video_assignment_id = $5,
          rubric_id = $6, prompt_template_ids = $7::jsonb, config_snapshot = $8::jsonb
        WHERE id = $1`,
      [id, institutionId, link?.program_id || null, link?.phase_id || null, link?.va_id || null,
       rubricId, promptIds ? JSON.stringify(promptIds) : null,
       JSON.stringify({
         source: videoAssignmentId ? 'server-config' : 'legacy-client',
         rubric_id: rubricId, rubric_version: rubricVersion,
         prompt_template_ids: promptIds, prompt_versions: promptVersions,
         model: model || null,
       })]);
  } catch (err) {
    console.error(`[tenant] could not tag ${table} #${id}:`, err.message);
  }
}
