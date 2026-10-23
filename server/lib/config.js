/**
 * Institution configuration: syllabus tree, rubric/prompt validation, cloning.
 */
import { pgPool } from '../db.js';

// ---------------------------------------------------------------------------
// Syllabus tree for /api/config, cached per institution for 60 s.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // institutionId -> { data, expiresAt }

export const invalidateConfig = (institutionId) => {
  if (institutionId) cache.delete(institutionId); else cache.clear();
};

export async function loadConfig(institutionId, { includeInactive = false } = {}) {
  if (!includeInactive) {
    const hit = cache.get(institutionId);
    if (hit && hit.expiresAt > Date.now()) return hit.data;
  }
  const active = (alias) => (includeInactive ? 'TRUE' : `${alias}.is_active`);
  const inst = (await pgPool.query(
    `SELECT id, name, slug, type, logo_url FROM institutions WHERE id = $1`, [institutionId])).rows[0];
  const programs = (await pgPool.query(
    `SELECT id, name, description, sort_order, is_active FROM programs p
      WHERE institution_id = $1 AND ${active('p')} ORDER BY sort_order, name`, [institutionId])).rows;
  const phases = (await pgPool.query(
    `SELECT ph.id, ph.program_id, ph.name, ph.description, ph.sort_order, ph.is_active
       FROM phases ph JOIN programs p ON p.id = ph.program_id
      WHERE p.institution_id = $1 AND ${active('ph')} AND ${active('p')}
      ORDER BY ph.sort_order, ph.name`, [institutionId])).rows;
  const videos = (await pgPool.query(
    `SELECT va.* FROM video_assignments va
       JOIN phases ph ON ph.id = va.phase_id JOIN programs p ON p.id = ph.program_id
      WHERE p.institution_id = $1 AND ${active('va')} AND ${active('ph')} AND ${active('p')}
      ORDER BY va.video_type, va.sort_order, va.title`, [institutionId])).rows;

  const videoOut = (v) => ({
    id: v.id, videoType: v.video_type, title: v.title, description: v.description,
    whatToCover: v.what_to_cover, questionsToAnswer: v.questions_to_answer, keyTopics: v.key_topics,
    rubricId: v.rubric_id, abilityRubricId: v.ability_rubric_id,
    accuracyPromptId: v.accuracy_prompt_id, abilityPromptId: v.ability_prompt_id, projectPromptId: v.project_prompt_id,
    sortOrder: v.sort_order, isActive: v.is_active,
  });
  const data = {
    institution: inst ? { id: inst.id, name: inst.name, slug: inst.slug, type: inst.type, logoUrl: inst.logo_url } : null,
    programs: programs.map((p) => ({
      id: p.id, name: p.name, description: p.description, sortOrder: p.sort_order, isActive: p.is_active,
      phases: phases.filter((ph) => ph.program_id === p.id).map((ph) => ({
        id: ph.id, name: ph.name, description: ph.description, sortOrder: ph.sort_order, isActive: ph.is_active,
        videos: videos.filter((v) => v.phase_id === ph.id).map(videoOut),
      })),
    })),
  };
  if (!includeInactive) cache.set(institutionId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

// ---------------------------------------------------------------------------
// Rubric validation. Criteria use the format the results page renders:
//   { "Parameter": "...", "Weightage (%)": 30, "<level 1>": "...", ..., "Checklist": [...] }
// Ability-to-explain rubrics are level rows: { "Level": "...", "<description key>": "..." }
// Returns { errors: [], warnings: [] }.
// ---------------------------------------------------------------------------
export function validateRubric({ rubric_type: type, levels, criteria }) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(criteria) || criteria.length === 0) errors.push('Add at least one criterion.');
  if (!Array.isArray(levels) || levels.length < 2) errors.push('Define at least two levels.');
  if (errors.length) return { errors, warnings };

  if (type === 'ability_to_explain') {
    criteria.forEach((row, i) => {
      if (!row || typeof row !== 'object' || !String(row.Level || '').trim()) errors.push(`Row ${i + 1}: "Level" is required.`);
      const text = Object.entries(row || {}).filter(([k]) => k !== 'Level').map(([, v]) => String(v || '').trim()).join('');
      if (!text) errors.push(`Row ${i + 1}: add a description of what this level looks like.`);
    });
    return { errors, warnings };
  }

  let total = 0;
  criteria.forEach((row, i) => {
    const n = i + 1;
    if (!row || typeof row !== 'object') { errors.push(`Criterion ${n} must be an object.`); return; }
    if (!String(row.Parameter || '').trim()) errors.push(`Criterion ${n}: "Parameter" (name) is required.`);
    const w = row['Weightage (%)'];
    if (typeof w !== 'number' || Number.isNaN(w) || w <= 0 || w > 100) {
      errors.push(`Criterion ${n}: "Weightage (%)" must be a number between 1 and 100.`);
    } else total += w;
    for (const level of levels) {
      if (!String(row[level] || '').trim()) errors.push(`Criterion ${n}: missing description for level "${level}".`);
    }
    if (row.Checklist !== undefined && !Array.isArray(row.Checklist)) errors.push(`Criterion ${n}: "Checklist" must be a list.`);
  });
  if (!errors.length && type === 'project' && total !== 100) {
    warnings.push(`Weights add up to ${total}%, not 100%. Scores are still produced; consider adjusting.`);
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Prompt validation: the response schema must contain the top-level fields the
// app reads for that kind of evaluation.
// ---------------------------------------------------------------------------
export const REQUIRED_OUTPUT_FIELDS = {
  accuracy: ['Accuracy Level'],
  ability_to_explain: ['Ability to explain'],
  project: ['video_validation', 'topic_coverage', 'parameters'],
  custom: ['evaluation_result'],
};

export function validatePrompt({ kind, prompt_text: text, generation_config: cfg }) {
  const errors = [];
  if (!String(text || '').trim()) errors.push('Prompt text is required.');
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    errors.push('Generation config must be a JSON object.');
    return { errors, warnings: [] };
  }
  const inner = cfg.generationConfig || cfg;
  const schema = inner.responseSchema;
  if (!schema || typeof schema !== 'object') errors.push('Generation config needs a "responseSchema".');
  else {
    const props = Object.keys(schema.properties || {});
    const missing = (REQUIRED_OUTPUT_FIELDS[kind] || []).filter((f) => !props.includes(f));
    if (missing.length) errors.push(`responseSchema.properties is missing: ${missing.join(', ')} (the results page needs these).`);
  }
  if (inner.responseMimeType && inner.responseMimeType !== 'application/json') {
    errors.push('responseMimeType must be "application/json".');
  }
  return { errors, warnings: [] };
}

// ---------------------------------------------------------------------------
// Clone an institution's active setup into another (new) institution.
// Runs inside the caller's transaction client.
// ---------------------------------------------------------------------------
export async function cloneInstitutionConfig(client, fromId, toId, actor) {
  const rubricMap = new Map();
  const rubrics = (await client.query(
    `SELECT DISTINCT ON (name) * FROM rubrics WHERE institution_id = $1 AND is_active
      ORDER BY name, version DESC`, [fromId])).rows;
  for (const r of rubrics) {
    const id = (await client.query(
      `INSERT INTO rubrics (institution_id, name, rubric_type, levels, criteria, version, created_by)
       VALUES ($1,$2,$3,$4,$5::text::json,1,$6) RETURNING id`,
      [toId, r.name, r.rubric_type, JSON.stringify(r.levels), JSON.stringify(r.criteria), actor])).rows[0].id;
    rubricMap.set(r.id, id);
  }
  // Videos may point at older versions too: map every version id of a name to the new copy.
  const allVersions = (await client.query(`SELECT id, name FROM rubrics WHERE institution_id = $1`, [fromId])).rows;
  for (const v of allVersions) {
    const latest = rubrics.find((r) => r.name === v.name);
    if (latest && !rubricMap.has(v.id)) rubricMap.set(v.id, rubricMap.get(latest.id));
  }

  const promptMap = new Map();
  const prompts = (await client.query(
    `SELECT DISTINCT ON (kind, name) * FROM prompt_templates WHERE institution_id = $1 AND is_active
      ORDER BY kind, name, version DESC`, [fromId])).rows;
  for (const p of prompts) {
    const id = (await client.query(
      `INSERT INTO prompt_templates (institution_id, kind, name, prompt_text, generation_config, version, created_by)
       VALUES ($1,$2,$3,$4,$5::text::json,1,$6) RETURNING id`,
      [toId, p.kind, p.name, p.prompt_text, JSON.stringify(p.generation_config), actor])).rows[0].id;
    promptMap.set(p.id, id);
  }
  const allPromptVersions = (await client.query(
    `SELECT id, kind, name FROM prompt_templates WHERE institution_id = $1`, [fromId])).rows;
  for (const v of allPromptVersions) {
    const latest = prompts.find((p) => p.kind === v.kind && p.name === v.name);
    if (latest && !promptMap.has(v.id)) promptMap.set(v.id, promptMap.get(latest.id));
  }
  const mapPrompt = (id) => (id ? promptMap.get(id) || id : null); // global defaults keep their id

  const programs = (await client.query(
    `SELECT * FROM programs WHERE institution_id = $1 AND is_active ORDER BY sort_order`, [fromId])).rows;
  let counts = { programs: 0, phases: 0, videos: 0, rubrics: rubrics.length, prompts: prompts.length };
  for (const p of programs) {
    const pid = (await client.query(
      `INSERT INTO programs (institution_id, name, description, sort_order) VALUES ($1,$2,$3,$4) RETURNING id`,
      [toId, p.name, p.description, p.sort_order])).rows[0].id;
    counts.programs++;
    const phases = (await client.query(
      `SELECT * FROM phases WHERE program_id = $1 AND is_active ORDER BY sort_order`, [p.id])).rows;
    for (const ph of phases) {
      const phid = (await client.query(
        `INSERT INTO phases (program_id, name, description, sort_order) VALUES ($1,$2,$3,$4) RETURNING id`,
        [pid, ph.name, ph.description, ph.sort_order])).rows[0].id;
      counts.phases++;
      const vids = (await client.query(
        `SELECT * FROM video_assignments WHERE phase_id = $1 AND is_active ORDER BY sort_order`, [ph.id])).rows;
      for (const v of vids) {
        await client.query(
          `INSERT INTO video_assignments (phase_id, video_type, title, description, what_to_cover,
             questions_to_answer, key_topics, rubric_id, ability_rubric_id,
             accuracy_prompt_id, ability_prompt_id, project_prompt_id, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [phid, v.video_type, v.title, v.description, v.what_to_cover,
           JSON.stringify(v.questions_to_answer), JSON.stringify(v.key_topics),
           v.rubric_id ? rubricMap.get(v.rubric_id) || null : null,
           v.ability_rubric_id ? rubricMap.get(v.ability_rubric_id) || null : null,
           mapPrompt(v.accuracy_prompt_id), mapPrompt(v.ability_prompt_id), mapPrompt(v.project_prompt_id),
           v.sort_order]);
        counts.videos++;
      }
    }
  }
  return counts;
}
