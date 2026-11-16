/**
 * Super-admin API (/api/super/*): institutions across the platform.
 */
import { z } from 'zod';
import { pgPool } from '../db.js';
import { requireRole, clearMembershipCache } from '../middleware/auth.js';
import { cloneInstitutionConfig, invalidateConfig } from '../lib/config.js';
import { audit } from '../lib/audit.js';
import { handle, HttpError } from './admin.js';

const uuid = z.string().uuid();
const domain = z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'not a domain');

const InstitutionIn = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,60}$/, 'lowercase letters, numbers and dashes'),
  type: z.enum(['school', 'college', 'university', 'bootcamp', 'ngo', 'other']).default('other'),
  allowedEmailDomains: z.array(domain).max(20).default([]),
  logoUrl: z.string().trim().max(1000).nullish(),
  adminEmail: z.string().trim().toLowerCase().email(),
  cloneFromInstitutionId: uuid.nullish(),
});

const STATS_SQL = `
  SELECT i.id, i.name, i.slug, i.type, i.status, i.allowed_email_domains, i.created_at,
         (i.gemini_api_key_encrypted IS NOT NULL) AS has_gemini_key,
         (SELECT COUNT(*) FROM user_memberships m WHERE m.institution_id = i.id AND m.role = 'student')::int AS students,
         (SELECT COUNT(*) FROM user_memberships m WHERE m.institution_id = i.id AND m.role = 'institution_admin')::int AS admins,
         (SELECT COUNT(*) FROM programs p WHERE p.institution_id = i.id AND p.is_active)::int AS programs,
         ((SELECT COUNT(*) FROM tbl_ailabs_ytfeedback_concept_evaluations c WHERE c.institution_id = i.id)
        + (SELECT COUNT(*) FROM tbl_ailabs_ytfeedback_project_evaluation e WHERE e.institution_id = i.id)
        + (SELECT COUNT(*) FROM tbl_ailabs_ytfeedback_custom_evaluations u WHERE u.institution_id = i.id))::int AS evaluations,
         (SELECT COALESCE(SUM(total_tokens),0) FROM tbl_llm_api_calls l
           WHERE l.institution_id = i.id AND l.created_at > NOW() - INTERVAL '30 days')::bigint AS tokens_30d
    FROM institutions i`;

const out = (r) => ({ ...r, tokens_30d: Number(r.tokens_30d) });

export function registerSuperRoutes(app) {
  const sup = requireRole('super_admin');

  app.get('/api/super/institutions', sup, handle(async (req, res) => {
    res.json((await pgPool.query(`${STATS_SQL} ORDER BY i.created_at`)).rows.map(out));
  }));

  app.post('/api/super/institutions', sup, handle(async (req, res) => {
    const b = InstitutionIn.parse(req.body);
    const c = await pgPool.connect();
    try {
      await c.query('BEGIN');
      const inst = (await c.query(
        `INSERT INTO institutions (name, slug, type, allowed_email_domains, logo_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [b.name, b.slug, b.type, b.allowedEmailDomains, b.logoUrl ?? null])).rows[0];
      await c.query(`INSERT INTO user_memberships (email, institution_id, role) VALUES ($1,$2,'institution_admin')`, [b.adminEmail, inst.id]);
      let cloned = null;
      if (b.cloneFromInstitutionId) {
        const src = (await c.query(`SELECT id FROM institutions WHERE id = $1`, [b.cloneFromInstitutionId])).rows[0];
        if (!src) throw new HttpError(400, 'Institution to clone from was not found');
        cloned = await cloneInstitutionConfig(c, src.id, inst.id, req.user.email);
      }
      await c.query('COMMIT');
      clearMembershipCache(b.adminEmail);
      await audit(req, 'create', 'institution', inst.id, { ...b, cloned }, inst.id);
      res.status(201).json({ institution: inst, adminEmail: b.adminEmail, cloned });
    } catch (e) {
      await c.query('ROLLBACK');
      if (e.code === '23505') throw new HttpError(409, `Slug "${b.slug}" is already taken`);
      throw e;
    } finally { c.release(); }
  }));

  app.patch('/api/super/institutions/:id', sup, handle(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const b = z.object({
      name: z.string().trim().min(2).max(200).optional(),
      type: InstitutionIn.shape.type.optional(),
      status: z.enum(['active', 'suspended']).optional(),
      allowedEmailDomains: z.array(domain).max(20).optional(),
      logoUrl: z.string().trim().max(1000).nullish(),
    }).parse(req.body);
    const row = (await pgPool.query(
      `UPDATE institutions SET name = COALESCE($2,name), type = COALESCE($3,type), status = COALESCE($4,status),
              allowed_email_domains = COALESCE($5,allowed_email_domains),
              logo_url = CASE WHEN $7 THEN $6 ELSE logo_url END, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [id, b.name ?? null, b.type ?? null, b.status ?? null, b.allowedEmailDomains ?? null, b.logoUrl ?? null, 'logoUrl' in b])).rows[0];
    if (!row) throw new HttpError(404, 'Institution not found');
    clearMembershipCache(); invalidateConfig(id);
    await audit(req, 'update', 'institution', id, b, id);
    res.json(row);
  }));

  // Add an admin (or any role) to any institution
  app.post('/api/super/institutions/:id/users', sup, handle(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const b = z.object({
      email: z.string().trim().toLowerCase().email(),
      role: z.enum(['student', 'evaluator', 'institution_admin']).default('institution_admin'),
    }).parse(req.body);
    const row = (await pgPool.query(
      `INSERT INTO user_memberships (email, institution_id, role) VALUES ($1,$2,$3)
       ON CONFLICT (email, COALESCE(institution_id,'00000000-0000-0000-0000-000000000000'::uuid), role) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`, [b.email, id, b.role])).rows[0];
    clearMembershipCache(b.email); await audit(req, 'create', 'user', row.id, b, id);
    res.status(201).json(row);
  }));

  app.get('/api/super/stats', sup, handle(async (req, res) => {
    const rows = (await pgPool.query(`${STATS_SQL} ORDER BY i.created_at`)).rows.map(out);
    const sum = (k) => rows.reduce((a, r) => a + Number(r[k] || 0), 0);
    res.json({
      institutions: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      students: sum('students'),
      evaluations: sum('evaluations'),
      tokens30d: sum('tokens_30d'),
      perInstitution: rows,
    });
  }));
}
