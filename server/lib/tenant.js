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

export async function tagEvaluation({ videoType, id, institutionId, phaseName, videoTitle, model }) {
  const table = TABLES[videoType];
  if (!table || !id || !institutionId) return;
  try {
    let link = null;
    if (videoType !== 'custom' && phaseName) {
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

    await pgPool.query(
      `UPDATE ${table} SET
          institution_id = $2, program_id = $3, phase_id = $4, video_assignment_id = $5,
          rubric_id = $6, prompt_template_ids = $7::jsonb, config_snapshot = $8::jsonb
        WHERE id = $1`,
      [id, institutionId, link?.program_id || null, link?.phase_id || null, link?.va_id || null,
       rubricId, promptIds ? JSON.stringify(promptIds) : null,
       JSON.stringify({ source: 'legacy-client', rubric_version: 1, prompt_version: 1, model: model || null })]);
  } catch (err) {
    console.error(`[tenant] could not tag ${table} #${id}:`, err.message);
  }
}
