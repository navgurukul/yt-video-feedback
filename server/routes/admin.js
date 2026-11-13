/**
 * Institution-admin API (/api/admin/*) and member config API (/api/config, /api/rubrics/:id).
 * Every query is scoped to req.tenant.institutionId.
 */
import { z } from 'zod';
import { pgPool } from '../db.js';
import { requireRole, clearMembershipCache } from '../middleware/auth.js';
import { loadConfig, invalidateConfig, validateRubric, validatePrompt } from '../lib/config.js';
import { encryptSecret, decryptSecret, maskSecret } from '../lib/crypto.js';
import { audit } from '../lib/audit.js';
import { resolveGeminiKey, loadAssignment, videoDetailsFor, runPrompt, composePrompt, GEMINI_MODELS } from '../lib/gemini.js';

// ---- helpers ------------------------------------------------------------------
export class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

export const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`) });
    }
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
    if (err.code === '23505') return res.status(409).json({ error: 'That name is already used here.' });
    console.error(`[${req.method} ${req.path}]`, err);
    res.status(500).json({ error: 'Something went wrong', message: err.message });
  }
};

const uuid = z.string().uuid();
const inst = (req) => req.tenant.institutionId;
const one = async (sql, params) => (await pgPool.query(sql, params)).rows[0];

async function assertProgram(req, id) {
  if (!await one(`SELECT 1 FROM programs WHERE id = $1 AND institution_id = $2`, [id, inst(req)])) throw new HttpError(404, 'Program not found');
}
async function assertPhase(req, id) {
  if (!await one(`SELECT 1 FROM phases ph JOIN programs p ON p.id = ph.program_id WHERE ph.id = $1 AND p.institution_id = $2`, [id, inst(req)])) {
    throw new HttpError(404, 'Phase not found');
  }
}
async function assertVideo(req, id) {
  const v = await one(
    `SELECT va.id, va.phase_id FROM video_assignments va JOIN phases ph ON ph.id = va.phase_id JOIN programs p ON p.id = ph.program_id
      WHERE va.id = $1 AND p.institution_id = $2`, [id, inst(req)]);
  if (!v) throw new HttpError(404, 'Video not found');
  return v;
}
async function assertRubric(req, id, type) {
  if (!id) return;
  const r = await one(`SELECT rubric_type FROM rubrics WHERE id = $1 AND institution_id = $2`, [id, inst(req)]);
  if (!r) throw new HttpError(400, `Rubric ${id} does not belong to this institution`);
  if (type && r.rubric_type !== type && r.rubric_type !== 'generic') throw new HttpError(400, `Rubric ${id} is a "${r.rubric_type}" rubric, expected "${type}"`);
}
async function assertPrompt(req, id, kind) {
  if (!id) return;
  const p = await one(`SELECT kind FROM prompt_templates WHERE id = $1 AND (institution_id = $2 OR institution_id IS NULL)`, [id, inst(req)]);
  if (!p) throw new HttpError(400, `Prompt ${id} is not available to this institution`);
  if (kind && p.kind !== kind) throw new HttpError(400, `Prompt ${id} is a "${p.kind}" prompt, expected "${kind}"`);
}

const camelRubric = (r) => r && ({
  id: r.id, name: r.name, rubricType: r.rubric_type, levels: r.levels, criteria: r.criteria,
  version: r.version, isActive: r.is_active, createdBy: r.created_by, createdAt: r.created_at,
});
const camelPrompt = (p) => p && ({
  id: p.id, kind: p.kind, name: p.name, promptText: p.prompt_text, generationConfig: p.generation_config,
  version: p.version, isActive: p.is_active, isGlobalDefault: p.institution_id === null,
  createdBy: p.created_by, createdAt: p.created_at,
});

async function reorder(table, parentCol, parentId, ids) {
  const c = await pgPool.connect();
  try {
    await c.query('BEGIN');
    for (const [i, id] of ids.entries()) {
      await c.query(`UPDATE ${table} SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND ${parentCol} = $3`, [i + 1, id, parentId]);
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

// ---- schemas --------------------------------------------------------------------
const ProgramIn = z.object({ name: z.string().trim().min(1).max(200), description: z.string().max(2000).nullish(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() });
const PhaseIn = z.object({ programId: uuid, name: z.string().trim().min(1).max(300), description: z.string().max(4000).nullish(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() });
const VideoIn = z.object({
  phaseId: uuid,
  videoType: z.enum(['concept', 'project']),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(4000).nullish(),
  whatToCover: z.string().max(8000).nullish(),
  questionsToAnswer: z.array(z.string().trim().min(1)).max(50).optional(),
  keyTopics: z.array(z.string().trim().min(1)).max(50).optional(),
  rubricId: uuid.nullish(), abilityRubricId: uuid.nullish(),
  accuracyPromptId: uuid.nullish(), abilityPromptId: uuid.nullish(), projectPromptId: uuid.nullish(),
  sortOrder: z.number().int().optional(), isActive: z.boolean().optional(),
});
const RubricIn = z.object({
  name: z.string().trim().min(1).max(200),
  rubricType: z.enum(['project', 'ability_to_explain', 'generic']),
  levels: z.array(z.string().trim().min(1)).min(2).max(10),
  criteria: z.array(z.record(z.string(), z.any())).min(1).max(50),
});
const RubricVersionIn = z.object({ levels: z.array(z.string().trim().min(1)).min(2).max(10).optional(), criteria: z.array(z.record(z.string(), z.any())).min(1).max(50) });
const PromptIn = z.object({
  kind: z.enum(['accuracy', 'ability_to_explain', 'project', 'custom']),
  name: z.string().trim().min(1).max(200),
  promptText: z.string().min(1).max(100000),
  generationConfig: z.record(z.string(), z.any()),
});
const PromptVersionIn = z.object({ promptText: z.string().min(1).max(100000), generationConfig: z.record(z.string(), z.any()) });
const Role = z.enum(['student', 'evaluator', 'institution_admin']);
const UserIn = z.object({ email: z.string().trim().toLowerCase().email(), role: Role, programId: uuid.nullish() });
const SettingsIn = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  logoUrl: z.string().trim().max(1000).nullish(),
  allowedEmailDomains: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'not a domain')).max(20).optional(),
  geminiApiKey: z.string().trim().min(10).max(200).nullish(),   // null removes the key
  manualEvalExcludedEmails: z.array(z.string().trim().toLowerCase().email()).max(100).optional(),
});

// =================================================================================
export function registerAdminRoutes(app) {
  // ---- member endpoints -----------------------------------------------------------
  app.get('/api/config', handle(async (req, res) => {
    res.json(await loadConfig(inst(req)));
  }));

  app.get('/api/rubrics/:id', handle(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const r = await one(`SELECT * FROM rubrics WHERE id = $1 AND (institution_id = $2 OR $3)`, [id, inst(req), req.tenant.isSuperAdmin]);
    if (!r) throw new HttpError(404, 'Rubric not found');
    res.json(camelRubric(r));
  }));

  // Everything below: institution_admin (or super_admin)
  const admin = requireRole('institution_admin');

  // ---- syllabus tree (includes inactive items) -------------------------------------
  app.get('/api/admin/config', admin, handle(async (req, res) => {
    res.json(await loadConfig(inst(req), { includeInactive: true }));
  }));

  // ---- programs ---------------------------------------------------------------------
  app.post('/api/admin/programs', admin, handle(async (req, res) => {
    const b = ProgramIn.parse(req.body);
    const row = await one(
      `INSERT INTO programs (institution_id, name, description, sort_order, is_active)
       VALUES ($1,$2,$3,COALESCE($4,(SELECT COALESCE(MAX(sort_order),0)+1 FROM programs WHERE institution_id=$1)),COALESCE($5,TRUE)) RETURNING *`,
      [inst(req), b.name, b.description ?? null, b.sortOrder ?? null, b.isActive ?? null]);
    invalidateConfig(inst(req)); await audit(req, 'create', 'program', row.id, b);
    res.status(201).json(row);
  }));
  app.patch('/api/admin/programs/:id', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id); await assertProgram(req, id);
    const b = ProgramIn.partial().parse(req.body);
    const row = await one(
      `UPDATE programs SET name = COALESCE($2,name), description = CASE WHEN $6 THEN $3 ELSE description END,
              sort_order = COALESCE($4,sort_order), is_active = COALESCE($5,is_active), updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [id, b.name ?? null, b.description ?? null, b.sortOrder ?? null, b.isActive ?? null, 'description' in b]);
    invalidateConfig(inst(req)); await audit(req, 'update', 'program', id, b);
    res.json(row);
  }));
  app.delete('/api/admin/programs/:id', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id); await assertProgram(req, id);
    await pgPool.query(`UPDATE programs SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
    invalidateConfig(inst(req)); await audit(req, 'deactivate', 'program', id);
    res.json({ success: true, message: 'Program deactivated (past evaluations are kept).' });
  }));

  // ---- phases -----------------------------------------------------------------------
  app.post('/api/admin/phases', admin, handle(async (req, res) => {
    const b = PhaseIn.parse(req.body); await assertProgram(req, b.programId);
    const row = await one(
      `INSERT INTO phases (program_id, name, description, sort_order, is_active)
       VALUES ($1,$2,$3,COALESCE($4,(SELECT COALESCE(MAX(sort_order),0)+1 FROM phases WHERE program_id=$1)),COALESCE($5,TRUE)) RETURNING *`,
      [b.programId, b.name, b.description ?? null, b.sortOrder ?? null, b.isActive ?? null]);
    invalidateConfig(inst(req)); await audit(req, 'create', 'phase', row.id, b);
    res.status(201).json(row);
  }));
  app.patch('/api/admin/phases/:id', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id); await assertPhase(req, id);
    const b = PhaseIn.omit({ programId: true }).partial().parse(req.body);
    const row = await one(
      `UPDATE phases SET name = COALESCE($2,name), description = CASE WHEN $6 THEN $3 ELSE description END,
              sort_order = COALESCE($4,sort_order), is_active = COALESCE($5,is_active), updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [id, b.name ?? null, b.description ?? null, b.sortOrder ?? null, b.isActive ?? null, 'description' in b]);
    invalidateConfig(inst(req)); await audit(req, 'update', 'phase', id, b);
    res.json(row);
  }));
  app.delete('/api/admin/phases/:id', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id); await assertPhase(req, id);
    await pgPool.query(`UPDATE phases SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
    invalidateConfig(inst(req)); await audit(req, 'deactivate', 'phase', id);
    res.json({ success: true, message: 'Phase deactivated (past evaluations are kept).' });
  }));
  app.post('/api/admin/programs/:id/phases/reorder', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id); await assertProgram(req, id);
    const { ids } = z.object({ ids: z.array(uuid).min(1) }).parse(req.body);
    await reorder('phases', 'program_id', id, ids);
    invalidateConfig(inst(req)); await audit(req, 'reorder', 'phase', id, { ids });
    res.json({ success: true });
  }));

  // ---- videos -----------------------------------------------------------------------
  const checkVideoLinks = async (req, b) => {
    await assertRubric(req, b.rubricId, 'project');
    await assertRubric(req, b.abilityRubricId, 'ability_to_explain');
    await assertPrompt(req, b.accuracyPromptId, 'accuracy');
    await assertPrompt(req, b.abilityPromptId, 'ability_to_explain');
    await assertPrompt(req, b.projectPromptId, 'project');
  };
  app.post('/api/admin/videos', admin, handle(async (req, res) => {
    const b = VideoIn.parse(req.body); await assertPhase(req, b.phaseId); await checkVideoLinks(req, b);
    const row = await one(
      `INSERT INTO video_assignments (phase_id, video_type, title, description, what_to_cover, questions_to_answer, key_topics,
          rubric_id, ability_rubric_id, accuracy_prompt_id, ability_prompt_id, project_prompt_id, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
               COALESCE($13,(SELECT COALESCE(MAX(sort_order),0)+1 FROM video_assignments WHERE phase_id=$1 AND video_type=$2)),COALESCE($14,TRUE))
       RETURNING *`,
      [b.phaseId, b.videoType, b.title, b.description ?? null, b.whatToCover ?? null,
       JSON.stringify(b.questionsToAnswer || []), JSON.stringify(b.keyTopics || []),
       b.rubricId ?? null, b.abilityRubricId ?? null, b.accuracyPromptId ?? null, b.abilityPromptId ?? null, b.projectPromptId ?? null,
       b.sortOrder ?? null, b.isActive ?? null]);
    invalidateConfig(inst(req)); await audit(req, 'create', 'video', row.id, b);
    res.status(201).json(row);
  }));
  app.patch('/api/admin/videos/:id', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id); await assertVideo(req, id);
    const b = VideoIn.omit({ phaseId: true, videoType: true }).partial().parse(req.body);
    await checkVideoLinks(req, b);
    const map = {
      title: 'title', description: 'description', whatToCover: 'what_to_cover', questionsToAnswer: 'questions_to_answer',
      keyTopics: 'key_topics', rubricId: 'rubric_id', abilityRubricId: 'ability_rubric_id', accuracyPromptId: 'accuracy_prompt_id',
      abilityPromptId: 'ability_prompt_id', projectPromptId: 'project_prompt_id', sortOrder: 'sort_order', isActive: 'is_active',
    };
    const sets = []; const vals = [id];
    for (const [k, col] of Object.entries(map)) {
      if (!(k in b)) continue;
      const v = ['questionsToAnswer', 'keyTopics'].includes(k) ? JSON.stringify(b[k] || []) : b[k] ?? null;
      vals.push(v); sets.push(`${col} = $${vals.length}`);
    }
    if (!sets.length) throw new HttpError(400, 'Nothing to update');
    const row = await one(`UPDATE video_assignments SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`, vals);
    invalidateConfig(inst(req)); await audit(req, 'update', 'video', id, b);
    res.json(row);
  }));
  app.delete('/api/admin/videos/:id', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id); await assertVideo(req, id);
    await pgPool.query(`UPDATE video_assignments SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
    invalidateConfig(inst(req)); await audit(req, 'deactivate', 'video', id);
    res.json({ success: true, message: 'Video deactivated (past evaluations are kept).' });
  }));
  app.post('/api/admin/phases/:id/videos/reorder', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id); await assertPhase(req, id);
    const { ids } = z.object({ ids: z.array(uuid).min(1) }).parse(req.body);
    await reorder('video_assignments', 'phase_id', id, ids);
    invalidateConfig(inst(req)); await audit(req, 'reorder', 'video', id, { ids });
    res.json({ success: true });
  }));

  // ---- rubrics (versioned) ----------------------------------------------------------
  // project_analysis rubrics and pa_* prompts belong to the Project Analyzer (same tables,
  // managed in its own admin), so they are hidden here.
  app.get('/api/admin/rubrics', admin, handle(async (req, res) => {
    const rows = (await pgPool.query(
      `SELECT DISTINCT ON (name) r.*, (SELECT COUNT(*)::int FROM rubrics x WHERE x.institution_id = r.institution_id AND x.name = r.name) AS versions
         FROM rubrics r WHERE institution_id = $1 AND rubric_type <> 'project_analysis' ORDER BY name, version DESC`, [inst(req)])).rows;
    res.json(rows.map((r) => ({ ...camelRubric(r), versions: r.versions })));
  }));
  app.get('/api/admin/rubrics/:id', admin, handle(async (req, res) => {
    const r = await one(`SELECT * FROM rubrics WHERE id = $1 AND institution_id = $2 AND rubric_type <> 'project_analysis'`, [uuid.parse(req.params.id), inst(req)]);
    if (!r) throw new HttpError(404, 'Rubric not found');
    res.json(camelRubric(r));
  }));
  app.get('/api/admin/rubrics/:id/versions', admin, handle(async (req, res) => {
    const r = await one(`SELECT name FROM rubrics WHERE id = $1 AND institution_id = $2 AND rubric_type <> 'project_analysis'`, [uuid.parse(req.params.id), inst(req)]);
    if (!r) throw new HttpError(404, 'Rubric not found');
    const rows = (await pgPool.query(`SELECT * FROM rubrics WHERE institution_id = $1 AND name = $2 ORDER BY version DESC`, [inst(req), r.name])).rows;
    res.json(rows.map(camelRubric));
  }));
  app.post('/api/admin/rubrics', admin, handle(async (req, res) => {
    const b = RubricIn.parse(req.body);
    const { errors, warnings } = validateRubric({ rubric_type: b.rubricType, levels: b.levels, criteria: b.criteria });
    if (errors.length) throw new HttpError(400, 'Rubric is not valid', errors);
    const row = await one(
      `INSERT INTO rubrics (institution_id, name, rubric_type, levels, criteria, version, created_by)
       VALUES ($1,$2,$3,$4,$5::text::json,1,$6) RETURNING *`,
      [inst(req), b.name, b.rubricType, JSON.stringify(b.levels), JSON.stringify(b.criteria), req.user.email]);
    await audit(req, 'create', 'rubric', row.id, { name: b.name });
    res.status(201).json({ ...camelRubric(row), warnings });
  }));
  // Editing = new version. Videos using the previous version move to the new one;
  // past evaluations keep pointing at the version they were graded with.
  app.post('/api/admin/rubrics/:id/versions', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const base = await one(`SELECT * FROM rubrics WHERE id = $1 AND institution_id = $2 AND rubric_type <> 'project_analysis'`, [id, inst(req)]);
    if (!base) throw new HttpError(404, 'Rubric not found');
    const b = RubricVersionIn.parse(req.body);
    const levels = b.levels || base.levels;
    const { errors, warnings } = validateRubric({ rubric_type: base.rubric_type, levels, criteria: b.criteria });
    if (errors.length) throw new HttpError(400, 'Rubric is not valid', errors);
    const c = await pgPool.connect();
    try {
      await c.query('BEGIN');
      const next = (await c.query(`SELECT COALESCE(MAX(version),0)+1 AS v FROM rubrics WHERE institution_id = $1 AND name = $2`, [inst(req), base.name])).rows[0].v;
      const row = (await c.query(
        `INSERT INTO rubrics (institution_id, name, rubric_type, levels, criteria, version, created_by)
         VALUES ($1,$2,$3,$4,$5::text::json,$6,$7) RETURNING *`,
        [inst(req), base.name, base.rubric_type, JSON.stringify(levels), JSON.stringify(b.criteria), next, req.user.email])).rows[0];
      const old = (await c.query(`UPDATE rubrics SET is_active = FALSE WHERE institution_id = $1 AND name = $2 AND id <> $3 RETURNING id`, [inst(req), base.name, row.id])).rows.map((r) => r.id);
      const moved = (await c.query(
        `UPDATE video_assignments SET
            rubric_id = CASE WHEN rubric_id = ANY($1) THEN $2 ELSE rubric_id END,
            ability_rubric_id = CASE WHEN ability_rubric_id = ANY($1) THEN $2 ELSE ability_rubric_id END,
            updated_at = NOW()
          WHERE rubric_id = ANY($1) OR ability_rubric_id = ANY($1)`, [old, row.id])).rowCount;
      await c.query('COMMIT');
      invalidateConfig(inst(req)); await audit(req, 'new_version', 'rubric', row.id, { name: base.name, version: next, from: id, videosMoved: moved });
      res.status(201).json({ ...camelRubric(row), warnings, videosUpdated: moved });
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }));

  // ---- prompts (versioned; global defaults are read-only here) ----------------------
  app.get('/api/admin/prompts', admin, handle(async (req, res) => {
    const rows = (await pgPool.query(
      `SELECT DISTINCT ON (COALESCE(institution_id::text,'global'), kind, name) p.*,
              (SELECT COUNT(*)::int FROM prompt_templates x WHERE x.institution_id IS NOT DISTINCT FROM p.institution_id AND x.kind = p.kind AND x.name = p.name) AS versions
         FROM prompt_templates p WHERE (institution_id = $1 OR institution_id IS NULL) AND kind NOT LIKE 'pa\\_%'
        ORDER BY COALESCE(institution_id::text,'global'), kind, name, version DESC`, [inst(req)])).rows;
    res.json(rows.map((p) => ({ ...camelPrompt(p), versions: p.versions })));
  }));
  app.get('/api/admin/prompts/:id', admin, handle(async (req, res) => {
    const p = await one(`SELECT * FROM prompt_templates WHERE id = $1 AND (institution_id = $2 OR institution_id IS NULL) AND kind NOT LIKE 'pa\\_%'`, [uuid.parse(req.params.id), inst(req)]);
    if (!p) throw new HttpError(404, 'Prompt not found');
    res.json(camelPrompt(p));
  }));
  app.get('/api/admin/prompts/:id/versions', admin, handle(async (req, res) => {
    const p = await one(`SELECT * FROM prompt_templates WHERE id = $1 AND (institution_id = $2 OR institution_id IS NULL) AND kind NOT LIKE 'pa\\_%'`, [uuid.parse(req.params.id), inst(req)]);
    if (!p) throw new HttpError(404, 'Prompt not found');
    const rows = (await pgPool.query(
      `SELECT * FROM prompt_templates WHERE institution_id IS NOT DISTINCT FROM $1 AND kind = $2 AND name = $3 ORDER BY version DESC`,
      [p.institution_id, p.kind, p.name])).rows;
    res.json(rows.map(camelPrompt));
  }));
  app.post('/api/admin/prompts', admin, handle(async (req, res) => {
    const b = PromptIn.parse(req.body);
    const { errors } = validatePrompt({ kind: b.kind, prompt_text: b.promptText, generation_config: b.generationConfig });
    if (errors.length) throw new HttpError(400, 'Prompt is not valid', errors);
    const row = await one(
      `INSERT INTO prompt_templates (institution_id, kind, name, prompt_text, generation_config, version, created_by)
       VALUES ($1,$2,$3,$4,$5::text::json,1,$6) RETURNING *`,
      [inst(req), b.kind, b.name, b.promptText, JSON.stringify(b.generationConfig), req.user.email]);
    await audit(req, 'create', 'prompt', row.id, { kind: b.kind, name: b.name });
    res.status(201).json(camelPrompt(row));
  }));
  app.post('/api/admin/prompts/:id/versions', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const base = await one(`SELECT * FROM prompt_templates WHERE id = $1 AND institution_id = $2 AND kind NOT LIKE 'pa\\_%'`, [id, inst(req)]);
    if (!base) throw new HttpError(404, 'Prompt not found (global default prompts cannot be edited; create your own copy instead)');
    const b = PromptVersionIn.parse(req.body);
    const { errors } = validatePrompt({ kind: base.kind, prompt_text: b.promptText, generation_config: b.generationConfig });
    if (errors.length) throw new HttpError(400, 'Prompt is not valid', errors);
    const c = await pgPool.connect();
    try {
      await c.query('BEGIN');
      const next = (await c.query(`SELECT COALESCE(MAX(version),0)+1 AS v FROM prompt_templates WHERE institution_id = $1 AND kind = $2 AND name = $3`, [inst(req), base.kind, base.name])).rows[0].v;
      const row = (await c.query(
        `INSERT INTO prompt_templates (institution_id, kind, name, prompt_text, generation_config, version, created_by)
         VALUES ($1,$2,$3,$4,$5::text::json,$6,$7) RETURNING *`,
        [inst(req), base.kind, base.name, b.promptText, JSON.stringify(b.generationConfig), next, req.user.email])).rows[0];
      const old = (await c.query(
        `UPDATE prompt_templates SET is_active = FALSE WHERE institution_id = $1 AND kind = $2 AND name = $3 AND id <> $4 RETURNING id`,
        [inst(req), base.kind, base.name, row.id])).rows.map((r) => r.id);
      const moved = (await c.query(
        `UPDATE video_assignments SET
            accuracy_prompt_id = CASE WHEN accuracy_prompt_id = ANY($1) THEN $2 ELSE accuracy_prompt_id END,
            ability_prompt_id  = CASE WHEN ability_prompt_id  = ANY($1) THEN $2 ELSE ability_prompt_id END,
            project_prompt_id  = CASE WHEN project_prompt_id  = ANY($1) THEN $2 ELSE project_prompt_id END,
            updated_at = NOW()
          WHERE accuracy_prompt_id = ANY($1) OR ability_prompt_id = ANY($1) OR project_prompt_id = ANY($1)`, [old, row.id])).rowCount;
      await c.query('COMMIT');
      invalidateConfig(inst(req)); await audit(req, 'new_version', 'prompt', row.id, { kind: base.kind, name: base.name, version: next, from: id, videosMoved: moved });
      res.status(201).json({ ...camelPrompt(row), videosUpdated: moved });
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }));
  // Dry run: evaluate a YouTube video with this prompt; nothing is stored.
  app.post('/api/admin/prompts/:id/test', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const p = await one(`SELECT * FROM prompt_templates WHERE id = $1 AND (institution_id = $2 OR institution_id IS NULL)`, [id, inst(req)]);
    if (!p) throw new HttpError(404, 'Prompt not found');
    const b = z.object({
      videoUrl: z.string().url(), videoAssignmentId: uuid, apiKey: z.string().optional(), model: z.enum(GEMINI_MODELS).optional(),
    }).parse(req.body);
    const va = await loadAssignment(b.videoAssignmentId, inst(req));
    if (!va) throw new HttpError(404, 'Video not found');
    let rubric = null;
    const rubricId = p.kind === 'project' ? va.rubric_id : p.kind === 'ability_to_explain' ? va.ability_rubric_id : null;
    if (rubricId) rubric = (await one(`SELECT criteria FROM rubrics WHERE id = $1`, [rubricId]))?.criteria || null;
    const promptText = composePrompt({ promptbegining: p.prompt_text, videoDetails: videoDetailsFor(va), rubric });
    const { key, source } = await resolveGeminiKey(inst(req), b.apiKey);
    if (!key) throw new HttpError(400, 'No Gemini API key: set one in institution settings or send apiKey.');
    const started = Date.now();
    const out = await runPrompt({ apiKey: key, model: b.model, videoUrl: b.videoUrl, promptText, generationConfig: p.generation_config });
    await audit(req, 'test', 'prompt', id, { videoUrl: b.videoUrl, videoAssignmentId: b.videoAssignmentId, keySource: source });
    res.json({ promptText, keySource: source, latencyMs: Date.now() - started, ...out });
  }));

  // ---- users ------------------------------------------------------------------------
  app.get('/api/admin/users', admin, handle(async (req, res) => {
    const rows = (await pgPool.query(
      `SELECT m.id, m.email, m.role, m.program_id, p.name AS program_name, m.created_at,
              (SELECT COUNT(*)::int FROM tbl_ailabs_ytfeedback_concept_evaluations c WHERE lower(c.email) = m.email AND c.institution_id = m.institution_id)
            + (SELECT COUNT(*)::int FROM tbl_ailabs_ytfeedback_project_evaluation e WHERE lower(e.email) = m.email AND e.institution_id = m.institution_id) AS evaluations
         FROM user_memberships m LEFT JOIN programs p ON p.id = m.program_id
        WHERE m.institution_id = $1 ORDER BY m.role DESC, m.email`, [inst(req)])).rows;
    res.json(rows);
  }));
  app.post('/api/admin/users', admin, handle(async (req, res) => {
    const b = UserIn.parse(req.body);
    if (b.programId) await assertProgram(req, b.programId);
    const row = await one(
      `INSERT INTO user_memberships (email, institution_id, role, program_id) VALUES ($1,$2,$3,$4)
       ON CONFLICT (email, COALESCE(institution_id,'00000000-0000-0000-0000-000000000000'::uuid), role)
         DO UPDATE SET program_id = EXCLUDED.program_id RETURNING *`,
      [b.email, inst(req), b.role, b.programId ?? null]);
    clearMembershipCache(b.email); await audit(req, 'create', 'user', row.id, b);
    res.status(201).json(row);
  }));
  app.patch('/api/admin/users/:id', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const m = await one(`SELECT * FROM user_memberships WHERE id = $1 AND institution_id = $2`, [id, inst(req)]);
    if (!m) throw new HttpError(404, 'User not found');
    const b = z.object({ role: Role.optional(), programId: uuid.nullish() }).parse(req.body);
    if (m.email === req.user.email && m.role === 'institution_admin' && b.role && b.role !== 'institution_admin') {
      throw new HttpError(400, 'You cannot remove your own admin role.');
    }
    if (b.programId) await assertProgram(req, b.programId);
    const row = await one(
      `UPDATE user_memberships SET role = COALESCE($2, role), program_id = CASE WHEN $4 THEN $3 ELSE program_id END
        WHERE id = $1 RETURNING *`, [id, b.role ?? null, b.programId ?? null, 'programId' in b]);
    clearMembershipCache(m.email); await audit(req, 'update', 'user', id, b);
    res.json(row);
  }));
  app.delete('/api/admin/users/:id', admin, handle(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const m = await one(`SELECT * FROM user_memberships WHERE id = $1 AND institution_id = $2`, [id, inst(req)]);
    if (!m) throw new HttpError(404, 'User not found');
    if (m.email === req.user.email && m.role === 'institution_admin') throw new HttpError(400, 'You cannot remove your own admin access.');
    await pgPool.query(`DELETE FROM user_memberships WHERE id = $1`, [id]);
    clearMembershipCache(m.email); await audit(req, 'delete', 'user', id, { email: m.email, role: m.role });
    res.json({ success: true, message: 'Access removed. Their past evaluations are kept.' });
  }));

  // ---- settings -----------------------------------------------------------------------
  const settingsOut = (i) => {
    let masked = null;
    if (i.gemini_api_key_encrypted) { try { masked = maskSecret(decryptSecret(i.gemini_api_key_encrypted)); } catch { masked = '(unreadable — re-enter key)'; } }
    return {
      id: i.id, name: i.name, slug: i.slug, type: i.type, logoUrl: i.logo_url, status: i.status,
      allowedEmailDomains: i.allowed_email_domains,
      manualEvalExcludedEmails: i.settings?.manual_eval_excluded_emails || [],
      gemini: { hasKey: !!i.gemini_api_key_encrypted, masked },
    };
  };
  app.get('/api/admin/settings', admin, handle(async (req, res) => {
    res.json(settingsOut(await one(`SELECT * FROM institutions WHERE id = $1`, [inst(req)])));
  }));
  app.put('/api/admin/settings', admin, handle(async (req, res) => {
    const b = SettingsIn.parse(req.body);
    const sets = []; const vals = [inst(req)];
    const add = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    if (b.name !== undefined) add('name', b.name);
    if ('logoUrl' in b) add('logo_url', b.logoUrl ?? null);
    if (b.allowedEmailDomains) add('allowed_email_domains', b.allowedEmailDomains);
    if ('geminiApiKey' in b) add('gemini_api_key_encrypted', b.geminiApiKey ? encryptSecret(b.geminiApiKey) : null);
    if (b.manualEvalExcludedEmails) {
      vals.push(JSON.stringify(b.manualEvalExcludedEmails));
      sets.push(`settings = jsonb_set(COALESCE(settings,'{}'::jsonb), '{manual_eval_excluded_emails}', $${vals.length}::jsonb, true)`);
    }
    if (!sets.length) throw new HttpError(400, 'Nothing to update');
    const row = await one(`UPDATE institutions SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`, vals);
    clearMembershipCache(); invalidateConfig(inst(req));
    await audit(req, 'update', 'settings', inst(req), { ...b, geminiApiKey: 'geminiApiKey' in b ? (b.geminiApiKey ? 'set' : 'removed') : undefined });
    res.json(settingsOut(row));
  }));

  // ---- stats --------------------------------------------------------------------------
  app.get('/api/admin/stats', admin, handle(async (req, res) => {
    const i = inst(req);
    const byPhase = (await pgPool.query(
      `SELECT pr.name AS program, ph.name AS phase, ph.sort_order,
              COUNT(*) FILTER (WHERE x.kind = 'concept')::int AS concept, COUNT(*) FILTER (WHERE x.kind = 'project')::int AS project
         FROM (SELECT phase_id, 'concept' AS kind FROM tbl_ailabs_ytfeedback_concept_evaluations WHERE institution_id = $1
               UNION ALL SELECT phase_id, 'project' FROM tbl_ailabs_ytfeedback_project_evaluation WHERE institution_id = $1) x
         JOIN phases ph ON ph.id = x.phase_id JOIN programs pr ON pr.id = ph.program_id
        GROUP BY 1, 2, 3 ORDER BY 1, 3`, [i])).rows;
    const totals = await one(
      `SELECT (SELECT COUNT(*) FROM tbl_ailabs_ytfeedback_concept_evaluations WHERE institution_id = $1)::int AS concept,
              (SELECT COUNT(*) FROM tbl_ailabs_ytfeedback_project_evaluation WHERE institution_id = $1)::int AS project,
              (SELECT COUNT(*) FROM tbl_ailabs_ytfeedback_custom_evaluations WHERE institution_id = $1)::int AS custom,
              (SELECT COUNT(*) FROM tbl_manual_video_evaluations WHERE institution_id = $1)::int AS manual,
              (SELECT COUNT(*) FROM user_memberships WHERE institution_id = $1 AND role = 'student')::int AS students`, [i]);
    const active = await one(
      `SELECT COUNT(DISTINCT lower(email))::int AS n FROM (
         SELECT email FROM tbl_ailabs_ytfeedback_concept_evaluations WHERE institution_id = $1 AND created_at > NOW() - INTERVAL '30 days'
         UNION ALL SELECT email FROM tbl_ailabs_ytfeedback_project_evaluation WHERE institution_id = $1 AND created_at > NOW() - INTERVAL '30 days') x`, [i]);
    const tokens = await one(
      `SELECT COUNT(*)::int AS calls, COALESCE(SUM(total_tokens),0)::bigint AS tokens,
              COUNT(*) FILTER (WHERE http_status >= 400)::int AS failed
         FROM tbl_llm_api_calls WHERE institution_id = $1 AND created_at > NOW() - INTERVAL '30 days'`, [i]);
    res.json({ totals, activeStudents30d: active.n, llm30d: { ...tokens, tokens: Number(tokens.tokens) }, byPhase });
  }));
}
