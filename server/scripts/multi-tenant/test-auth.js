// End-to-end authorization tests against the TEST database.
//
//   cd server && node scripts/multi-tenant/test-auth.js
//
// Starts the real API (DB_TARGET=test) on port 3999 with a stub Supabase Auth on
// port 3998 that accepts tokens of the form "tok:<email>", so no real Google
// logins are needed. Creates a temporary "Auth Test Demo College" tenant and
// removes it afterwards. Never touches the main database.
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { test as db, closeAll } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../..');
const API = 'http://127.0.0.1:3999';
const DEMO = { slug: 'auth-test-demo-college', domain: 'auth-test-demo.edu' };

let pass = 0, fail = 0;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); cond ? pass++ : fail++; };

// ---- stub Supabase Auth ------------------------------------------------------
const stub = http.createServer((req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (req.url === '/auth/v1/user' && token.startsWith('tok:')) {
    const email = token.slice(4);
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ id: `stub-${email}`, email }));
  }
  res.writeHead(401); res.end('{}');
});

const call = async (method, url, email, { headers = {}, body } = {}) => {
  const h = { 'content-type': 'application/json', ...headers };
  if (email) h.authorization = `Bearer tok:${email}`;
  const r = await fetch(API + url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};

let server;
try {
  // ---- fixtures in TEST ------------------------------------------------------
  const ng = (await db.query(`SELECT id FROM institutions WHERE slug = 'navgurukul'`)).rows[0].id;
  const [a, b] = (await db.query(
    `SELECT lower(email) email, COUNT(*)::int n, MIN(id) id FROM tbl_ailabs_ytfeedback_concept_evaluations
      WHERE institution_id = $1 GROUP BY 1 ORDER BY 2 DESC LIMIT 2`, [ng])).rows;
  const evaluator = (await db.query(
    `SELECT email FROM user_memberships WHERE institution_id = $1 AND role = 'evaluator' LIMIT 1`, [ng])).rows[0]?.email;
  const superAdmin = (await db.query(`SELECT email FROM user_memberships WHERE role = 'super_admin' LIMIT 1`)).rows[0]?.email;
  if (!a || !b || !evaluator) throw new Error('Test DB needs 2 students with concept evaluations and 1 evaluator (run run.js first)');

  await db.query(`DELETE FROM institutions WHERE slug = $1`, [DEMO.slug]);
  const demo = (await db.query(
    `INSERT INTO institutions (name, slug, type, allowed_email_domains)
     VALUES ('Auth Test Demo College', $1, 'college', $2) RETURNING id`, [DEMO.slug, [DEMO.domain]])).rows[0].id;
  const demoStudent = `student1@${DEMO.domain}`;
  await db.query(`INSERT INTO user_memberships (email, institution_id, role) VALUES ($1, $2, 'student')`, [demoStudent, demo]);
  const demoEval = (await db.query(
    `INSERT INTO tbl_ailabs_ytfeedback_concept_evaluations (email, project_name, page_name, video_url, institution_id)
     VALUES ($1, 'Demo Phase', 'Demo Video', 'https://youtu.be/demo', $2) RETURNING id`, [demoStudent, demo])).rows[0].id;
  const ngTotal = (await db.query(
    `SELECT (SELECT COUNT(*) FROM tbl_ailabs_ytfeedback_concept_evaluations WHERE institution_id = $1)
          + (SELECT COUNT(*) FROM tbl_ailabs_ytfeedback_project_evaluation WHERE institution_id = $1)
          + (SELECT COUNT(*) FROM tbl_ailabs_ytfeedback_custom_evaluations WHERE institution_id = $1) AS n`, [ng])).rows[0].n;

  // ---- start stub + API ------------------------------------------------------
  await new Promise((r) => stub.listen(3998, '127.0.0.1', r));
  server = spawn(process.execPath, ['index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DB_TARGET: 'test', PORT: '3999', SUPABASE_URL: 'http://127.0.0.1:3998', SUPABASE_ANON_KEY: 'stub' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(API + '/health')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  for (let i = 0; i < 25 && !/Connected to PostgreSQL/.test(log); i++) await new Promise((r) => setTimeout(r, 200));
  check(/target=test database=/.test(log), 'API started against the TEST database');

  // ---- tests ---------------------------------------------------------------------
  check((await call('GET', '/health')).status === 200, '/health is public');
  check((await call('GET', '/concept-history')).status === 401, 'no token → 401');
  check((await fetch(API + '/concept-history', { headers: { authorization: 'Bearer garbage' } })).status === 401, 'invalid token → 401');

  let r = await call('GET', '/concept-history', a.email);
  check(r.status === 200 && r.json.data.length === a.n && r.json.data.every((x) => x.email.toLowerCase() === a.email),
    `student A sees exactly their own ${a.n} concept evaluations`);

  r = await call('GET', `/concept-history?email=${encodeURIComponent(b.email)}`, a.email);
  check(r.status === 200 && r.json.data.every((x) => x.email.toLowerCase() === a.email),
    'student A passing ?email=<B> still gets only A\'s rows');

  check((await call('GET', `/concept-evaluation/${b.id}`, a.email)).status === 404, 'student A cannot read student B\'s evaluation by id');
  check((await call('DELETE', `/concept-evaluation/${b.id}`, a.email)).status === 404, 'student A cannot delete student B\'s evaluation');
  check((await db.query(`SELECT 1 FROM tbl_ailabs_ytfeedback_concept_evaluations WHERE id = $1`, [b.id])).rowCount === 1,
    'student B\'s evaluation still exists');
  check((await call('GET', `/concept-evaluation/${a.id}`, a.email)).status === 200, 'student A can read their own evaluation');

  check((await call('GET', '/all-evaluations', a.email)).status === 403, 'student → 403 on /all-evaluations');
  check((await call('GET', '/manual-eval-videos', a.email)).status === 403, 'student → 403 on /manual-eval-videos');
  check((await call('POST', '/manual-evaluation', a.email, { body: { projectEvaluationId: 1, evaluationJson: {} } })).status === 403,
    'student → 403 on POST /manual-evaluation');

  r = await call('GET', '/all-evaluations?limit=500', evaluator);
  check(r.status === 200 && Number(r.json.pagination.total) === Number(ngTotal), `Navgurukul evaluator sees all ${ngTotal} Navgurukul evaluations`);
  r = await call('GET', '/all-evaluations?search=Demo%20Phase', evaluator);
  check(r.status === 200 && r.json.data.length === 0, 'Navgurukul evaluator cannot see Demo College rows');
  check((await call('GET', `/concept-evaluation/${demoEval}`, evaluator)).status === 404, 'Navgurukul evaluator cannot open a Demo College evaluation');
  check((await call('GET', `/concept-evaluation/${b.id}`, evaluator)).status === 200, 'Navgurukul evaluator can open a Navgurukul student\'s evaluation');
  check((await call('GET', '/manual-eval-videos', evaluator)).status === 200, 'evaluator can load the manual-evaluation queue');

  r = await call('GET', '/concept-history', demoStudent);
  check(r.status === 200 && r.json.data.length === 1 && r.json.data[0].id === demoEval, 'Demo College student sees only their own row');
  check((await call('GET', `/concept-evaluation/${a.id}`, demoStudent)).status === 404, 'Demo College student cannot open a Navgurukul evaluation');
  check((await call('GET', '/concept-history', demoStudent, { headers: { 'x-institution-id': ng } })).json?.data?.every((x) => x.id === demoEval),
    'X-Institution-Id for an institution you don\'t belong to is ignored');

  r = await call('GET', '/api/me', 'stranger@unknown-school.org');
  check(r.status === 403 && r.json?.code === 'NOT_ENROLLED', 'unknown email domain → 403 NOT_ENROLLED');

  r = await call('GET', '/api/me', `newcomer@${DEMO.domain}`);
  check(r.status === 200 && r.json.role === 'student' && r.json.activeInstitution?.id === demo,
    'new user with an allowed email domain is auto-joined as a student');

  r = await call('GET', '/api/me', a.email);
  check(r.status === 200 && r.json.activeInstitution?.slug === 'navgurukul', '/api/me returns the active institution');

  if (superAdmin) {
    r = await call('GET', `/all-evaluations?institutionId=${demo}`, superAdmin);
    check(r.status === 200 && r.json.data.some((x) => x.id === demoEval), 'super admin can view another institution');
  }

  if (fail) console.log('\n--- server log (last 40 lines) ---\n' + log.split('\n').slice(-40).join('\n'));
} catch (e) {
  console.error('ERROR:', e.message);
  fail++;
} finally {
  if (server) server.kill();
  stub.close();
  await db.query(`DELETE FROM tbl_ailabs_ytfeedback_concept_evaluations WHERE institution_id IN (SELECT id FROM institutions WHERE slug = $1)`, [DEMO.slug]);
  await db.query(`DELETE FROM user_memberships WHERE email LIKE $1`, [`%@${DEMO.domain}`]);
  await db.query(`DELETE FROM institutions WHERE slug = $1`, [DEMO.slug]);
  await closeAll();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
