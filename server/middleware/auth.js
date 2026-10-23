/**
 * Authentication + tenant context.
 *
 * 1. Verifies the Supabase access token (Authorization: Bearer <token>) by asking
 *    Supabase Auth who it belongs to (GET /auth/v1/user). This works whatever
 *    signing method the Supabase project uses (legacy HS256 secret or the newer
 *    asymmetric keys) and needs no secret on the server. Results are cached
 *    in memory for up to 5 minutes (never past the token's own expiry).
 * 2. Loads the user's memberships. If there are none, auto-joins them as a
 *    student of an active institution whose allowed_email_domains contains
 *    their email domain; otherwise responds 403 NOT_ENROLLED.
 * 3. Sets req.user = { id, email } and req.tenant = { institutionId, role, programId, isSuperAdmin }.
 */
import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pgPool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') }); // frontend .env has the Supabase URL/key

const env = (k) => (process.env[k] ?? '').trim();
const SUPABASE_URL = (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/+$/, '');
const SUPABASE_KEY = env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_PUBLISHABLE_KEY');

export const ROLE_RANK = { student: 1, evaluator: 2, institution_admin: 3, super_admin: 4 };

const TOKEN_TTL_MS = 5 * 60 * 1000;
const MEMBERSHIP_TTL_MS = 60 * 1000;
const tokenCache = new Map();       // sha256(token) -> { user, expiresAt }
const membershipCache = new Map();  // email -> { rows, expiresAt }

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function tokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.exp ? payload.exp * 1000 : null;
  } catch { return null; }
}

async function verifyToken(token) {
  const key = sha(token);
  const hit = tokenCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.user;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw Object.assign(new Error('Supabase URL/key not configured on the server'), { status: 500 });
  }
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const u = await r.json();
  if (!u?.email) return null;

  const user = { id: u.id, email: String(u.email).trim().toLowerCase() };
  const exp = tokenExpiry(token);
  tokenCache.set(key, { user, expiresAt: Math.min(Date.now() + TOKEN_TTL_MS, exp || Infinity) });
  if (tokenCache.size > 5000) tokenCache.clear();
  return user;
}

async function loadMemberships(email) {
  const hit = membershipCache.get(email);
  if (hit && hit.expiresAt > Date.now()) return hit.rows;
  const { rows } = await pgPool.query(
    `SELECT m.role, m.institution_id, m.program_id,
            i.name AS institution_name, i.slug, i.logo_url, i.status, i.settings
       FROM user_memberships m
       LEFT JOIN institutions i ON i.id = m.institution_id
      WHERE m.email = $1 AND (m.institution_id IS NULL OR i.status = 'active')`, [email]);
  membershipCache.set(email, { rows, expiresAt: Date.now() + MEMBERSHIP_TTL_MS });
  return rows;
}

async function autoJoinByDomain(email) {
  const domain = email.split('@')[1];
  if (!domain) return false;
  const r = await pgPool.query(
    `INSERT INTO user_memberships (email, institution_id, role)
     SELECT $1, id, 'student' FROM institutions
      WHERE status = 'active' AND $2 = ANY(allowed_email_domains)
     ON CONFLICT DO NOTHING
     RETURNING id`, [email, domain]);
  membershipCache.delete(email);
  return r.rowCount > 0;
}

export function clearMembershipCache(email) {
  if (email) membershipCache.delete(email.toLowerCase()); else membershipCache.clear();
}

/** Picks the active institution and the user's highest role in it. */
async function resolveTenant(memberships, requestedId) {
  const isSuperAdmin = memberships.some((m) => m.role === 'super_admin');
  const byInstitution = new Map();
  for (const m of memberships) {
    if (!m.institution_id) continue;
    const cur = byInstitution.get(m.institution_id);
    if (!cur || ROLE_RANK[m.role] > ROLE_RANK[cur.role]) byInstitution.set(m.institution_id, m);
  }

  let chosen = null;
  if (requestedId && byInstitution.has(requestedId)) chosen = byInstitution.get(requestedId);
  else if (requestedId && isSuperAdmin) {
    const r = await pgPool.query(`SELECT id FROM institutions WHERE id::text = $1`, [requestedId]);
    if (r.rowCount) chosen = { institution_id: r.rows[0].id, role: 'super_admin', program_id: null };
  }
  if (!chosen) chosen = [...byInstitution.values()][0] || null;
  if (!chosen && isSuperAdmin) {
    const r = await pgPool.query(`SELECT id FROM institutions WHERE status = 'active' ORDER BY created_at LIMIT 1`);
    if (r.rowCount) chosen = { institution_id: r.rows[0].id, role: 'super_admin', program_id: null };
  }
  if (!chosen) return null;

  return {
    institutionId: chosen.institution_id,
    role: isSuperAdmin ? 'super_admin' : chosen.role,
    programId: chosen.program_id || null,
    isSuperAdmin,
  };
}

/** Express middleware: every route registered after it requires a valid login. */
export async function authenticate(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Not signed in', code: 'UNAUTHENTICATED' });

    const user = await verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Session expired, please sign in again', code: 'UNAUTHENTICATED' });

    let memberships = await loadMemberships(user.email);
    if (!memberships.length && await autoJoinByDomain(user.email)) {
      memberships = await loadMemberships(user.email);
    }
    const tenant = memberships.length ? await resolveTenant(memberships, req.headers['x-institution-id']) : null;
    if (!tenant) {
      return res.status(403).json({
        error: "Your institution hasn't been set up on this platform yet. Please contact your admin.",
        code: 'NOT_ENROLLED',
      });
    }

    req.user = user;
    req.memberships = memberships;
    req.tenant = tenant;

    // Legacy clients send the email themselves; the verified identity always wins.
    const legacy = [
      [req.query, 'email'], [req.body, 'userEmail'], [req.body, 'evaluatorEmail'],
    ];
    for (const [obj, key] of legacy) {
      if (obj && typeof obj[key] === 'string') {
        if (obj[key].trim().toLowerCase() !== user.email) {
          console.warn(`[auth] ${req.method} ${req.path}: ignoring ${key}=${obj[key]} (signed in as ${user.email})`);
        }
        obj[key] = user.email;
      }
    }
    next();
  } catch (err) {
    console.error('[auth] error:', err.message);
    res.status(err.status || 500).json({ error: 'Authentication failed', code: 'AUTH_ERROR' });
  }
}

/** requireRole('evaluator') = evaluator or higher. */
export const requireRole = (minRole) => (req, res, next) => {
  if ((ROLE_RANK[req.tenant?.role] || 0) >= ROLE_RANK[minRole]) return next();
  return res.status(403).json({ error: 'You do not have permission for this action', code: 'FORBIDDEN' });
};

export const hasRole = (req, minRole) => (ROLE_RANK[req.tenant?.role] || 0) >= ROLE_RANK[minRole];
