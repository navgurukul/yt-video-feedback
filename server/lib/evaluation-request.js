/**
 * Server-side prompt resolution for POST /evaluate.
 *
 * The client sends { videoAssignmentId, evaluationKind } (or evaluationKind 'custom'
 * with customPrompt/customContext). The server loads the institution's video
 * assignment, rubric and prompt template from the DB and returns exactly the pieces
 * the legacy client used to send, so the final prompt text is byte-identical.
 */
import { pgPool } from '../db.js';
import { loadAssignment, videoDetailsFor } from './gemini.js';
import { buildCustomVideoDetails } from './prompt-builder.js';

export class EvaluateRequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const EVALUATION_KINDS = ['accuracy', 'ability_to_explain', 'project', 'custom'];
// evaluationType values the rest of the app (metrics, logs) already uses
const LEGACY_TYPE = { accuracy: 'accuracy', ability_to_explain: 'ability', project: 'project', custom: 'custom' };

const one = async (sql, params) => (await pgPool.query(sql, params)).rows[0] || null;

export async function resolveEvaluationRequest(body, institutionId) {
  const kind = body.evaluationKind;
  if (!EVALUATION_KINDS.includes(kind)) {
    throw new EvaluateRequestError(400, `evaluationKind must be one of: ${EVALUATION_KINDS.join(', ')}`);
  }

  if (kind === 'custom') {
    if (!String(body.customPrompt || '').trim()) throw new EvaluateRequestError(400, 'customPrompt is required for a custom evaluation');
    const tpl = await one(
      `SELECT id, version, prompt_text, generation_config FROM prompt_templates
        WHERE kind = 'custom' AND is_active AND (institution_id = $1 OR institution_id IS NULL)
        ORDER BY institution_id NULLS LAST, version DESC LIMIT 1`, [institutionId]);
    if (!tpl) throw new EvaluateRequestError(500, 'No custom evaluation prompt is configured');
    return {
      promptbegining: tpl.prompt_text,
      structuredreturnedconfig: tpl.generation_config,
      videoDetails: buildCustomVideoDetails({ customPrompt: body.customPrompt, customContext: body.customContext }),
      rubric: undefined,
      customPrompt: body.customPrompt,
      evaluationType: LEGACY_TYPE.custom,
      meta: { evaluationKind: kind, videoAssignmentId: null, promptTemplateId: tpl.id, promptVersion: tpl.version, rubricId: null, rubricVersion: null },
    };
  }

  if (!body.videoAssignmentId) throw new EvaluateRequestError(400, 'videoAssignmentId is required');
  const va = await loadAssignment(body.videoAssignmentId, institutionId);
  if (!va || !va.is_active) throw new EvaluateRequestError(404, 'Video not found for your institution');

  const expectType = kind === 'project' ? 'project' : 'concept';
  if (va.video_type !== expectType) {
    throw new EvaluateRequestError(400, `A ${kind} evaluation needs a ${expectType} video, but this is a ${va.video_type} video`);
  }

  const promptId = { accuracy: va.accuracy_prompt_id, ability_to_explain: va.ability_prompt_id, project: va.project_prompt_id }[kind];
  const rubricId = { accuracy: null, ability_to_explain: va.ability_rubric_id, project: va.rubric_id }[kind];
  if (!promptId) throw new EvaluateRequestError(400, `This video has no ${kind} prompt configured. Ask your admin to set one.`);
  if (kind !== 'accuracy' && !rubricId) throw new EvaluateRequestError(400, `This video has no rubric configured for ${kind}. Ask your admin to set one.`);

  const tpl = await one(`SELECT id, version, prompt_text, generation_config FROM prompt_templates WHERE id = $1`, [promptId]);
  const rub = rubricId ? await one(`SELECT id, version, criteria FROM rubrics WHERE id = $1`, [rubricId]) : null;

  return {
    promptbegining: tpl.prompt_text,
    structuredreturnedconfig: tpl.generation_config,
    videoDetails: videoDetailsFor(va),
    rubric: rub ? rub.criteria : undefined,
    customPrompt: undefined,
    evaluationType: LEGACY_TYPE[kind],
    meta: {
      evaluationKind: kind, videoAssignmentId: va.id, phaseId: va.phase_id, programId: va.program_id,
      promptTemplateId: tpl.id, promptVersion: tpl.version,
      rubricId: rub?.id || null, rubricVersion: rub?.version || null,
    },
  };
}
