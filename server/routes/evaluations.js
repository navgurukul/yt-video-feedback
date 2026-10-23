/**
 * History, single-evaluation, delete, manual-evaluation and all-evaluations
 * endpoints, scoped to the signed-in user and their active institution.
 * Paths and response shapes are unchanged from the single-tenant version.
 */
import { pgPool } from '../db.js';
import { requireRole, hasRole } from '../middleware/auth.js';

const T = {
  concept: 'tbl_ailabs_ytfeedback_concept_evaluations',
  project: 'tbl_ailabs_ytfeedback_project_evaluation',
  custom: 'tbl_ailabs_ytfeedback_custom_evaluations',
};

const COLS = {
  concept: `id, email, project_name, page_name, video_url, concept_explanation_accuracy,
            concept_explanation_feedback, ability_to_explain_evaluation, ability_to_explain_feedback, created_at`,
  project: `id, email, project_name, video_url, project_explanation_evaluation,
            project_explanation_feedback, project_explanation_evaluationjson, created_at`,
  custom: `id, email, video_url, custom_prompt, custom_context, overall_assessment,
           criteria_analysis, custom_feedback, evaluation_json, created_at`,
};

const LABEL = { concept: 'Concept', project: 'Project', custom: 'Custom' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseId = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n > 0 && String(n) === String(v) ? n : null;
};

/** Institution an admin view should use: super_admin may pass ?institutionId=. */
function viewInstitution(req) {
  const q = req.query.institutionId;
  if (req.tenant.isSuperAdmin && typeof q === 'string' && UUID_RE.test(q)) return q;
  return req.tenant.institutionId;
}

export function registerEvaluationRoutes(app) {
  // ---- My history (own rows in the active institution) ----------------------
  for (const type of Object.keys(T)) {
    app.get(`/${type}-history`, async (req, res) => {
      try {
        const result = await pgPool.query(
          `SELECT ${COLS[type]} FROM ${T[type]}
            WHERE lower(email) = $1 AND institution_id = $2
            ORDER BY created_at DESC`,
          [req.user.email, req.tenant.institutionId]);
        res.json({ success: true, data: result.rows });
      } catch (err) {
        console.error(`Error fetching ${type} history:`, err);
        res.status(500).json({ error: String(err) });
      }
    });

    // ---- One evaluation: owner, or evaluator+ of the same institution --------
    app.get(`/${type}-evaluation/:id`, async (req, res) => {
      try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid evaluation id' });
        const result = await pgPool.query(
          `SELECT ${COLS[type]} FROM ${T[type]}
            WHERE id = $1
              AND ($4 OR institution_id = $2)
              AND ($5 OR lower(email) = $3)`,
          [id, req.tenant.institutionId, req.user.email, req.tenant.isSuperAdmin, hasRole(req, 'evaluator')]);
        if (!result.rows.length) return res.status(404).json({ error: `${LABEL[type]} evaluation not found` });
        res.json({ success: true, data: result.rows[0] });
      } catch (err) {
        console.error(`Error fetching ${type} evaluation:`, err);
        res.status(500).json({ error: String(err) });
      }
    });

    // ---- Delete: owner, or institution_admin+ of the same institution --------
    app.delete(`/${type}-evaluation/:id`, async (req, res) => {
      try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid evaluation id' });
        const result = await pgPool.query(
          `DELETE FROM ${T[type]}
            WHERE id = $1
              AND ($4 OR institution_id = $2)
              AND ($5 OR lower(email) = $3)
            RETURNING id`,
          [id, req.tenant.institutionId, req.user.email, req.tenant.isSuperAdmin, hasRole(req, 'institution_admin')]);
        if (!result.rows.length) return res.status(404).json({ error: `${LABEL[type]} evaluation not found` });
        res.json({ success: true, message: `${LABEL[type]} evaluation deleted successfully` });
      } catch (err) {
        console.error(`Error deleting ${type} evaluation:`, err);
        res.status(500).json({ error: String(err) });
      }
    });
  }

  // ---- Manual evaluation: list project videos (evaluator+) -------------------
  const fetchManualEvalVideos = async (req, res) => {
    try {
      const evaluationId = req.query.id ? parseId(req.query.id) : null;
      if (req.query.id && !evaluationId) return res.status(400).json({ error: 'Invalid evaluation id' });

      const institutionId = viewInstitution(req);
      const values = [institutionId];
      let query = `
        SELECT pe.id, pe.email, pe.project_name, pe.video_url,
               EXISTS (SELECT 1 FROM tbl_manual_video_evaluations me WHERE me.project_evaluation_id = pe.id) AS manual_evaluated
          FROM tbl_ailabs_ytfeedback_project_evaluation pe
          JOIN institutions i ON i.id = pe.institution_id
         WHERE pe.institution_id = $1
           AND pe.project_name IS NOT NULL
           AND NOT (lower(pe.email) IN (
                 SELECT lower(jsonb_array_elements_text(COALESCE(i.settings->'manual_eval_excluded_emails', '[]'::jsonb)))))`;
      if (evaluationId) {
        values.push(evaluationId);
        query += ` AND pe.id = $2`;
      }
      query += ` ORDER BY pe.project_name;`;
      const result = await pgPool.query(query, values);
      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error('Error fetching manual evaluation videos:', err);
      res.status(500).json({ error: String(err) });
    }
  };
  app.get('/manual-eval-videos', requireRole('evaluator'), fetchManualEvalVideos);
  app.get('/api/manual-eval-videos', requireRole('evaluator'), fetchManualEvalVideos);

  // ---- Manual evaluation: save (evaluator+, video must be in the institution) -
  const saveManualEvaluation = async (req, res) => {
    try {
      const { projectEvaluationId, evaluatedVideoUrl, projectName, phase, evaluationJson, overallRating, overallComments } = req.body;
      const projectId = parseId(projectEvaluationId);
      if (!projectId || !evaluationJson) return res.status(400).json({ error: 'Missing required fields' });

      const owner = await pgPool.query(
        `SELECT institution_id FROM tbl_ailabs_ytfeedback_project_evaluation WHERE id = $1`, [projectId]);
      const instId = owner.rows[0]?.institution_id;
      if (!instId || (!req.tenant.isSuperAdmin && instId !== req.tenant.institutionId)) {
        return res.status(404).json({ error: 'Project evaluation not found' });
      }

      const result = await pgPool.query(
        `INSERT INTO tbl_manual_video_evaluations (
            project_evaluation_id, evaluator_email, evaluated_video_url, project_name, phase,
            evaluation_json, overall_rating, overall_comments, institution_id,
            evaluation_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())
         RETURNING id;`,
        [projectId, req.user.email, evaluatedVideoUrl, projectName, phase, evaluationJson,
         overallRating || null, overallComments || null, instId]);
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error('Error saving manual evaluation:', err);
      res.status(500).json({ error: String(err) });
    }
  };
  app.post('/manual-evaluation', requireRole('evaluator'), saveManualEvaluation);
  app.post('/api/manual-evaluation', requireRole('evaluator'), saveManualEvaluation);

  // ---- All evaluations in the institution (evaluator+) ----------------------
  app.get('/all-evaluations', requireRole('evaluator'), async (req, res) => {
    try {
      const { page = 1, limit = 20, type, search, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
      const pageN = Math.max(parseInt(page, 10) || 1, 1);
      const limitN = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 500);
      const offset = (pageN - 1) * limitN;
      const institutionId = viewInstitution(req);
      const params = search ? [institutionId, `%${search}%`] : [institutionId];

      const want = (t) => !type || type === 'all' || type === t;
      let conceptRecords = [];
      let projectRecords = [];
      let customRecords = [];

      if (want('concept')) {
        conceptRecords = (await pgPool.query(
          `SELECT id, email, project_name, page_name, video_url, concept_explanation_accuracy,
                  concept_explanation_feedback, ability_to_explain_evaluation, ability_to_explain_feedback,
                  created_at, 'concept' AS type
             FROM ${T.concept}
            WHERE institution_id = $1
              ${search ? 'AND (email ILIKE $2 OR project_name ILIKE $2 OR page_name ILIKE $2)' : ''}
            ORDER BY created_at DESC`, params)).rows;
      }
      if (want('project')) {
        projectRecords = (await pgPool.query(
          `SELECT id, email, project_name, NULL AS page_name, video_url, project_explanation_evaluation,
                  project_explanation_feedback, project_explanation_evaluationjson, created_at, 'project' AS type
             FROM ${T.project}
            WHERE institution_id = $1
              ${search ? 'AND (email ILIKE $2 OR project_name ILIKE $2)' : ''}
            ORDER BY created_at DESC`, params)).rows;
      }
      if (want('custom')) {
        customRecords = (await pgPool.query(
          `SELECT id, email, NULL AS project_name, NULL AS page_name, video_url, custom_prompt,
                  overall_assessment, custom_feedback, evaluation_json, created_at, 'custom' AS type
             FROM ${T.custom}
            WHERE institution_id = $1
              ${search ? 'AND (email ILIKE $2 OR custom_prompt ILIKE $2)' : ''}
            ORDER BY created_at DESC`, params)).rows;
      }

      const allRecords = [...conceptRecords, ...projectRecords, ...customRecords];
      allRecords.sort((a, b) => {
        if (sortBy === 'email') {
          return sortOrder === 'asc' ? a.email.localeCompare(b.email) : b.email.localeCompare(a.email);
        } else if (sortBy === 'project_name') {
          return sortOrder === 'asc'
            ? (a.project_name || '').localeCompare(b.project_name || '')
            : (b.project_name || '').localeCompare(a.project_name || '');
        }
        return sortOrder === 'asc'
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const totalCount = allRecords.length;
      const uniqueEmails = new Set(allRecords.map((r) => r.email));
      res.json({
        success: true,
        data: allRecords.slice(offset, offset + limitN),
        pagination: { page: pageN, limit: limitN, total: totalCount, totalPages: Math.ceil(totalCount / limitN) },
        stats: {
          totalEvaluations: totalCount,
          uniqueStudents: uniqueEmails.size,
          conceptCount: conceptRecords.length,
          projectCount: projectRecords.length,
          customCount: customRecords.length,
        },
      });
    } catch (err) {
      console.error('Error fetching all evaluations:', err);
      res.status(500).json({ error: String(err) });
    }
  });
}
