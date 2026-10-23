import { pgPool } from '../db.js';

/** Records who changed what. Never throws. */
export async function audit(req, action, entity, entityId, details = null, institutionId = undefined) {
  try {
    await pgPool.query(
      `INSERT INTO audit_log (institution_id, actor_email, action, entity, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [institutionId === undefined ? req.tenant?.institutionId ?? null : institutionId,
       req.user?.email || 'unknown', action, entity, entityId ? String(entityId) : null,
       details ? JSON.stringify(details) : null]);
  } catch (err) {
    console.error('[audit] failed:', err.message);
  }
}
