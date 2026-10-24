// End-to-end tests for /api/config, /api/admin/* and /api/super/* against the TEST database.
//
//   cd server && node scripts/multi-tenant/test-admin.js
//
// Same harness as test-auth.js: real API on :3999 (DB_TARGET=test) + stub Supabase Auth
// on :3998 accepting "tok:<email>". Creates institutions with slugs starting
// "auth-test-" and deletes them at the end. Never touches the main database.
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { test as db, closeAll } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../..');
const API = 'http://127.0.0.1:3999';
const MBA = { slug: 'auth-test-demo-mba', domain: 'demo-mba.test' };
const ADMIN = `admin@${MBA.domain}`;
const STUDENT = `student@${MBA.domain}`;

let pass = 0, fail = 0;
const REPORT_LINES = [];
const _log = console.log.bind(console);
console.log = (...a) => { REPORT_LINES.push(a.join(' ')); _log(...a); };
const check = (cond, msg, extra) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && extra !== undefined ? `\n        ${JSON.stringify(extra).slice(0, 400)}` : ''}`);
  cond ? pass++ : fail++;
};

const stub = http.createServer((req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (req.url === '/auth/v1/user' && token.startsWith('tok:')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ id: `stub-${token.slice(4)}`, email: token.slice(4) }));
  }
  res.writeHead(401); res.end('{}');
});

const call = async (method, url, email, body, headers = {}) => {
  const h = { 'content-type': 'application/json', ...headers };
  if (email) h.authorization = `Bearer tok:${email}`;
  const r = await fetch(API + url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};

async function cleanup() {
  const ids = (await db.query(`SELECT id FROM institutions WHERE slug LIKE 'auth-test-%'`)).rows.map((r) => r.id);
  if (!ids.length) return;
  await db.query(`DELETE FROM audit_log WHERE institution_id = ANY($1)`, [ids]);
  await db.query(`DELETE FROM user_memberships WHERE institution_id = ANY($1)`, [ids]);
  // children first (video_assignments → rubrics/prompts are not cascaded)
  await db.query(`DELETE FROM video_assignments WHERE phase_id IN (SELECT ph.id FROM phases ph JOIN programs p ON p.id = ph.program_id WHERE p.institution_id = ANY($1))`, [ids]);
  await db.query(`DELETE FROM institutions WHERE id = ANY($1)`, [ids]);
}

let server;
try {
  await cleanup();
  const superAdmin = (await db.query(`SELECT email FROM user_memberships WHERE role = 'super_admin' LIMIT 1`)).rows[0]?.email;
  const ng = (await db.query(`SELECT id FROM institutions WHERE slug = 'navgurukul'`)).rows[0].id;
  const ngEvaluator = (await db.query(`SELECT email FROM user_memberships WHERE institution_id = $1 AND role = 'evaluator' LIMIT 1`, [ng])).rows[0]?.email;
  const ngRubric = (await db.query(`SELECT id FROM rubrics WHERE institution_id = $1 AND rubric_type = 'project' LIMIT 1`, [ng])).rows[0].id;
  const ngPhase = (await db.query(`SELECT ph.id FROM phases ph JOIN programs p ON p.id = ph.program_id WHERE p.institution_id = $1 LIMIT 1`, [ng])).rows[0].id;
  if (!superAdmin) throw new Error('No super_admin in the test DB: run run.js --super-admin <email>');

  await new Promise((r) => stub.listen(3998, '127.0.0.1', r));
  server = spawn(process.execPath, ['index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DB_TARGET: 'test', PORT: '3999', SUPABASE_URL: 'http://127.0.0.1:3998', SUPABASE_ANON_KEY: 'stub',
           ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'test-only-encryption-key-0123456789' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(API + '/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  // Wait until the API has its first DB connection (slow networks take a few seconds)
  for (let i = 0; i < 100 && !/Connected to PostgreSQL|PostgreSQL connection error/.test(log); i++) await new Promise((r) => setTimeout(r, 200));

  // ---- super admin creates an institution ------------------------------------------
  let r = await call('POST', '/api/super/institutions', superAdmin, {
    name: 'Demo MBA College', slug: MBA.slug, type: 'college', allowedEmailDomains: [MBA.domain], adminEmail: ADMIN,
  });
  check(r.status === 201, 'super admin creates "Demo MBA College" with its first admin', r.json);
  const mba = r.json?.institution?.id;
  check((await call('POST', '/api/super/institutions', superAdmin, { name: 'Dup', slug: MBA.slug, adminEmail: ADMIN })).status === 409, 'duplicate slug → 409');
  check((await call('POST', '/api/super/institutions', ADMIN, { name: 'X', slug: 'auth-test-x', adminEmail: ADMIN })).status === 403, 'institution admin cannot create institutions');

  // ---- institution admin builds a syllabus -----------------------------------------
  r = await call('POST', '/api/admin/programs', ADMIN, { name: 'MBA 2026', description: 'Presentation skills' });
  check(r.status === 201, 'admin creates program', r.json);
  const program = r.json?.id;
  r = await call('POST', '/api/admin/phases', ADMIN, { programId: program, name: 'Module 1: Marketing Fundamentals' });
  check(r.status === 201, 'admin creates phase', r.json);
  const phase = r.json?.id;

  const levels = ['Beginner (1)', 'Intermediate (2)', 'Advanced (3)', 'Expert (4)'];
  const crit = (name, w) => ({ Parameter: name, 'Weightage (%)': w, ...Object.fromEntries(levels.map((l) => [l, `${name} at ${l}`])), Checklist: [`Mentions ${name}`] });
  r = await call('POST', '/api/admin/rubrics', ADMIN, { name: 'Pitch Rubric', rubricType: 'project', levels, criteria: [{ Parameter: 'Clarity', 'Weightage (%)': 50 }] });
  check(r.status === 400 && Array.isArray(r.json?.details) && r.json.details.some((d) => d.includes('missing description')), 'invalid rubric (missing level text) → 400 with reasons', r.json);
  r = await call('POST', '/api/admin/rubrics', ADMIN, { name: 'Pitch Rubric', rubricType: 'project', levels, criteria: [crit('Clarity', 50), crit('Market analysis', 40)] });
  check(r.status === 201 && r.json?.warnings?.length === 1, 'rubric with weights totalling 90% is saved with a warning', r.json);
  const rubric = r.json?.id;
  r = await call('POST', '/api/admin/rubrics', ADMIN, { name: 'Explaining Rubric', rubricType: 'ability_to_explain', levels: ['Beginner', 'Expert'],
    criteria: [{ Level: 'Beginner', Description: 'Vague' }, { Level: 'Expert', Description: 'Crystal clear' }] });
  check(r.status === 201, 'ability-to-explain rubric saved', r.json);
  const abilityRubric = r.json?.id;

  r = await call('GET', '/api/admin/prompts', ADMIN);
  const globals = (r.json || []).filter((p) => p.isGlobalDefault);
  check(r.status === 200 && globals.length === 4, 'admin sees the 4 global default prompts', r.json?.length);
  const globalProject = globals.find((p) => p.kind === 'project');
  r = await call('POST', '/api/admin/prompts', ADMIN, { kind: 'project', name: 'MBA Pitch Prompt', promptText: 'Evaluate the pitch.', generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { score: { type: 'NUMBER' } } } } });
  check(r.status === 400 && JSON.stringify(r.json).includes('parameters'), 'prompt whose schema lacks the fields the results page needs → 400', r.json);
  r = await call('POST', '/api/admin/prompts', ADMIN, { kind: 'project', name: 'MBA Pitch Prompt', promptText: 'You evaluate MBA pitch videos.', generationConfig: globalProject.generationConfig });
  check(r.status === 201 && r.json?.version === 1, 'admin creates own project prompt', r.json);
  const prompt = r.json?.id;
  check((await call('POST', `/api/admin/prompts/${globalProject.id}/versions`, ADMIN, { promptText: 'x', generationConfig: globalProject.generationConfig })).status === 404,
    'global default prompts cannot be edited by an institution');

  r = await call('POST', '/api/admin/videos', ADMIN, { phaseId: phase, videoType: 'project', title: 'Final Pitch', whatToCover: 'Pitch your product', keyTopics: ['Market', 'Pricing'], rubricId: rubric, projectPromptId: prompt });
  check(r.status === 201, 'admin creates project video linked to rubric + prompt', r.json);
  const projectVideo = r.json?.id;
  const accuracyGlobal = globals.find((p) => p.kind === 'accuracy').id;
  const abilityGlobal = globals.find((p) => p.kind === 'ability_to_explain').id;
  r = await call('POST', '/api/admin/videos', ADMIN, { phaseId: phase, videoType: 'concept', title: 'What is the 4P model?', whatToCover: 'Explain 4P', questionsToAnswer: ['What are the 4Ps?'], abilityRubricId: abilityRubric, accuracyPromptId: accuracyGlobal, abilityPromptId: abilityGlobal });
  check(r.status === 201, 'admin creates concept video using global default prompts', r.json);
  const conceptVideo = r.json?.id;
  check((await call('POST', '/api/admin/videos', ADMIN, { phaseId: phase, videoType: 'project', title: 'Steal', rubricId: ngRubric })).status === 400,
    'linking another institution\'s rubric → 400');
  check((await call('PATCH', `/api/admin/phases/${ngPhase}`, ADMIN, { name: 'hacked' })).status === 404, 'admin cannot edit another institution\'s phase');

  // ---- student view -----------------------------------------------------------------
  r = await call('GET', '/api/config', STUDENT);
  const prog = r.json?.programs?.[0];
  check(r.status === 200 && r.json.institution?.slug === MBA.slug && r.json.programs.length === 1 && prog?.phases?.[0]?.videos?.length === 2,
    'auto-joined MBA student sees exactly 1 program, 1 phase, 2 videos in /api/config', r.json);
  check(!JSON.stringify(r.json).includes('Student Profile & Course Portal'), 'MBA config contains nothing from Navgurukul');
  r = await call('GET', `/api/rubrics/${rubric}`, STUDENT);
  check(r.status === 200 && r.json?.criteria?.length === 2, 'student can load their institution\'s rubric');
  check((await call('GET', `/api/rubrics/${ngRubric}`, STUDENT)).status === 404, 'student cannot load another institution\'s rubric');
  check((await call('POST', '/api/admin/programs', STUDENT, { name: 'x' })).status === 403, 'student → 403 on admin API');
  if (ngEvaluator) check((await call('GET', '/api/admin/settings', ngEvaluator)).status === 403, 'evaluator → 403 on admin API');

  // ---- versioning -----------------------------------------------------------------------
  r = await call('POST', `/api/admin/rubrics/${rubric}/versions`, ADMIN, { criteria: [crit('Clarity', 50), crit('Market analysis', 50)] });
  check(r.status === 201 && r.json?.version === 2 && r.json?.videosUpdated === 1 && r.json?.warnings?.length === 0, 'editing a rubric creates version 2 and moves the video to it', r.json);
  const rubricV2 = r.json?.id;
  r = await call('GET', `/api/admin/rubrics/${rubric}/versions`, ADMIN);
  check(r.status === 200 && r.json.length === 2 && r.json[1].isActive === false, 'version history keeps v1 (inactive)');
  r = await call('GET', '/api/config', STUDENT);
  check(r.json?.programs?.[0]?.phases?.[0]?.videos?.find((v) => v.id === projectVideo)?.rubricId === rubricV2, '/api/config immediately shows the new rubric version (cache invalidated)');
  r = await call('POST', `/api/admin/prompts/${prompt}/versions`, ADMIN, { promptText: 'You evaluate MBA pitch videos strictly.', generationConfig: globalProject.generationConfig });
  check(r.status === 201 && r.json?.version === 2 && r.json?.videosUpdated === 1, 'editing a prompt creates version 2 and moves the video to it', r.json);

  // ---- key order is preserved (rubric text sent to Gemini must not change) --------------
  const stored = (await db.query(`SELECT criteria::text AS t FROM rubrics WHERE id = $1`, [rubricV2])).rows[0].t;
  check(stored.indexOf('"Parameter"') < stored.indexOf('"Weightage (%)"') && stored.indexOf('"Weightage (%)"') < stored.indexOf('"Beginner (1)"'),
    'rubric criteria keep their key order in the DB');

  // ---- settings + encrypted Gemini key ------------------------------------------------
  r = await call('PUT', '/api/admin/settings', ADMIN, { geminiApiKey: 'AIzaTESTKEY-abcd1234', logoUrl: 'https://example.com/logo.png' });
  check(r.status === 200 && r.json?.gemini?.hasKey && r.json.gemini.masked === '••••1234', 'Gemini key saved and only the last 4 characters are returned', r.json);
  const raw = (await db.query(`SELECT gemini_api_key_encrypted AS k FROM institutions WHERE id = $1`, [mba])).rows[0].k;
  check(raw.startsWith('v1:') && !raw.includes('AIzaTESTKEY'), 'Gemini key is encrypted at rest');
  r = await call('PUT', '/api/admin/settings', ADMIN, { allowedEmailDomains: ['Not A Domain'] });
  check(r.status === 400, 'invalid email domain → 400');

  // ---- users --------------------------------------------------------------------------
  r = await call('POST', '/api/admin/users', ADMIN, { email: `Mentor@${MBA.domain}`, role: 'evaluator', programId: program });
  check(r.status === 201 && r.json?.email === `mentor@${MBA.domain}`, 'admin invites an evaluator (email normalised)', r.json);
  const mentorId = r.json?.id;
  check((await call('GET', '/api/admin/users', ADMIN)).json?.length >= 3, 'admin lists users');
  check((await call('PATCH', `/api/admin/users/${mentorId}`, ADMIN, { role: 'student' })).status === 200, 'admin changes a role');
  const adminRow = (await db.query(`SELECT id FROM user_memberships WHERE email = $1 AND institution_id = $2`, [ADMIN, mba])).rows[0].id;
  check((await call('DELETE', `/api/admin/users/${adminRow}`, ADMIN)).status === 400, 'admin cannot remove their own admin access');
  check((await call('POST', '/api/admin/users', ADMIN, { email: 'x@y.com', role: 'super_admin' })).status === 400, 'admin cannot grant super_admin');

  // ---- deactivate ---------------------------------------------------------------------
  check((await call('DELETE', `/api/admin/videos/${conceptVideo}`, ADMIN)).status === 200, 'admin deactivates a video');
  r = await call('GET', '/api/config', STUDENT);
  check(r.json?.programs?.[0]?.phases?.[0]?.videos?.length === 1, 'deactivated video disappears from /api/config');
  r = await call('GET', '/api/admin/config', ADMIN);
  check(r.json?.programs?.[0]?.phases?.[0]?.videos?.length === 2, 'admin tree still shows the inactive video');

  // ---- stats + audit ------------------------------------------------------------------
  r = await call('GET', '/api/admin/stats', ADMIN);
  check(r.status === 200 && r.json?.totals?.students >= 1, 'admin stats', r.json);
  const audits = Number((await db.query(`SELECT COUNT(*) FROM audit_log WHERE institution_id = $1`, [mba])).rows[0].count);
  check(audits >= 10, `admin changes are recorded in audit_log (${audits} entries)`);

  // ---- clone Navgurukul -----------------------------------------------------------------
  r = await call('POST', '/api/super/institutions', superAdmin, {
    name: 'Navgurukul Clone Test', slug: 'auth-test-ng-clone', adminEmail: `admin@ng-clone.test`, cloneFromInstitutionId: ng,
  });
  // Navgurukul's rubric count includes Project Analyzer rubrics once that tool's run.js has been run
  const ngRubrics = Number((await db.query(`SELECT COUNT(DISTINCT name) n FROM rubrics WHERE institution_id = $1 AND is_active`, [ng])).rows[0].n);
  check(r.status === 201 && r.json?.cloned?.phases === 7 && r.json.cloned.videos === 77 && r.json.cloned.rubrics === ngRubrics,
    `new institution cloned from Navgurukul gets 7 phases, 77 videos, ${ngRubrics} rubrics`, r.json?.cloned);
  const clone = r.json?.institution?.id;
  const sameText = (await db.query(
    `SELECT COUNT(*)::int n FROM rubrics a JOIN rubrics b ON a.name = b.name
      WHERE a.institution_id = $1 AND b.institution_id = $2 AND a.is_active AND b.is_active AND a.criteria::text = b.criteria::text`, [ng, clone])).rows[0].n;
  check(sameText === ngRubrics, 'cloned rubrics are byte-identical to the originals');

  r = await call('GET', '/api/super/stats', superAdmin);
  check(r.status === 200 && r.json?.institutions >= 3, 'super admin stats', r.json?.institutions);
  r = await call('PATCH', `/api/super/institutions/${mba}`, superAdmin, { status: 'suspended' });
  check(r.status === 200, 'super admin suspends an institution');
  check((await call('GET', '/api/config', `newuser@${MBA.domain}`)).status === 403, 'nobody new can join a suspended institution');

  if (fail) console.log('\n--- server log (last 30 lines) ---\n' + log.split('\n').slice(-30).join('\n'));
} catch (e) {
  console.error('ERROR:', e);
  fail++;
} finally {
  if (server) server.kill();
  stub.close();
  try { await cleanup(); } catch (e) { console.error('cleanup failed:', e.message); }
  await closeAll();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
  try {
    const fs = await import('fs');
    fs.writeFileSync(path.join(__dirname, 'last-test-admin.txt'), `${new Date().toISOString()}\n` + REPORT_LINES.join('\n') + '\n');
  } catch { /* report file is optional */ }
}
