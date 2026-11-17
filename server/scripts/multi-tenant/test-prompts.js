// Prompt 5 check: the server-built prompt (from the DB) is byte-identical to the
// prompt the legacy frontend builds, for EVERY Navgurukul video and evaluation kind.
//
//   cd server && node scripts/multi-tenant/test-prompts.js
//
// Runs the real POST /evaluate code path with EVALUATE_DRY_RUN=1 (returns the composed
// prompt instead of calling Gemini; only honoured when DB_TARGET=test). Uses the same
// stub-login harness as test-auth.js. Writes last-test-prompts.txt.
import http from 'http';
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { test as db, closeAll } from './db.js';
import { buildConceptVideoDetails, buildProjectVideoDetails, buildCustomVideoDetails } from '../../lib/prompt-builder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../..');
const API = 'http://127.0.0.1:3999';
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'navgurukul-seed.json'), 'utf8'));

let pass = 0, fail = 0;
const LINES = [];
const out = (s) => { LINES.push(s); console.log(s); };
const check = (cond, msg, extra) => {
  out(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && extra !== undefined ? `\n        ${String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600)}` : ''}`);
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

let STUDENT;
const evaluate = async (body) => {
  const r = await fetch(API + '/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer tok:${STUDENT}` },
    body: JSON.stringify({ videoUrl: 'https://youtu.be/dry-run', apiKey: 'dry-run-key', ...body }),
  });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};

// Same rubric choice as the legacy switch in VideoAnalyzer.tsx
const legacyRubric = (phase) => seed.rubrics[`Phase${(phase.match(/^Phase (\d+)/) || [])[1]}Rubric`] || seed.rubrics.Phase1Rubric;

const firstDiff = (a, b) => {
  const n = Math.min(a.length, b.length);
  let i = 0; while (i < n && a[i] === b[i]) i++;
  return `differs at char ${i}: legacy=…${JSON.stringify(a.slice(i, i + 80))}… server=…${JSON.stringify(b.slice(i, i + 80))}…`;
};

let server;
try {
  const ng = (await db.query(`SELECT id FROM institutions WHERE slug = 'navgurukul'`)).rows[0].id;
  STUDENT = (await db.query(
    `SELECT email FROM user_memberships m WHERE institution_id = $1 AND role = 'student'
        AND NOT EXISTS (SELECT 1 FROM user_memberships x WHERE x.email = m.email AND x.role <> 'student') LIMIT 1`, [ng])).rows[0].email;
  const vas = (await db.query(
    `SELECT va.id, va.video_type, va.title, ph.name AS phase FROM video_assignments va
       JOIN phases ph ON ph.id = va.phase_id JOIN programs p ON p.id = ph.program_id
      WHERE p.institution_id = $1 AND va.is_active`, [ng])).rows;
  const vaId = (type, phase, title) => vas.find((v) => v.video_type === type && v.phase === phase && (type === 'project' || v.title === title))?.id;

  await new Promise((r) => stub.listen(3998, '127.0.0.1', r));
  server = spawn(process.execPath, ['index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DB_TARGET: 'test', PORT: '3999', SUPABASE_URL: 'http://127.0.0.1:3998', SUPABASE_ANON_KEY: 'stub', EVALUATE_DRY_RUN: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(API + '/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  for (let i = 0; i < 100 && !/Connected to PostgreSQL|PostgreSQL connection error/.test(log); i++) await new Promise((r) => setTimeout(r, 200));
  check(/target=test/.test(log), 'API started against the TEST database in dry-run mode');

  // ---- every video × kind: legacy body vs { videoAssignmentId, evaluationKind } ----------
  const cases = [];
  for (const ph of seed.videoDataStructure) {
    for (const v of ph.videos) {
      const details = buildConceptVideoDetails(v);
      const id = vaId('concept', ph.phase, v.title);
      cases.push({ label: `${ph.phase.slice(0, 8)} concept "${v.title}" accuracy`, id, kind: 'accuracy',
        legacy: { videoDetails: details, promptbegining: seed.prompts.accuracy.text, structuredreturnedconfig: seed.prompts.accuracy.config, evaluationType: 'accuracy' } });
      cases.push({ label: `${ph.phase.slice(0, 8)} concept "${v.title}" ability`, id, kind: 'ability_to_explain',
        legacy: { videoDetails: details, rubric: seed.rubrics.abilityToExplainRubric, promptbegining: seed.prompts.ability_to_explain.text, structuredreturnedconfig: seed.prompts.ability_to_explain.config, evaluationType: 'ability' } });
    }
  }
  for (const ph of seed.projectVideoDataStructure) {
    cases.push({ label: `${ph.phase.slice(0, 8)} project`, id: vaId('project', ph.phase), kind: 'project',
      legacy: { videoDetails: buildProjectVideoDetails(ph.projectVideo), rubric: legacyRubric(ph.phase), promptbegining: seed.prompts.project.text, structuredreturnedconfig: seed.prompts.project.config, evaluationType: 'project' } });
  }

  let identical = 0;
  const problems = [];
  for (const c of cases) {
    if (!c.id) { problems.push(`${c.label}: no video assignment in DB`); continue; }
    const a = await evaluate(c.legacy);
    const b = await evaluate({ videoAssignmentId: c.id, evaluationKind: c.kind });
    if (a.status !== 200 || b.status !== 200) { problems.push(`${c.label}: HTTP ${a.status}/${b.status} ${JSON.stringify(b.json).slice(0, 200)}`); continue; }
    if (a.json.promptText !== b.json.promptText) { problems.push(`${c.label}: prompt ${firstDiff(a.json.promptText, b.json.promptText)}`); continue; }
    if (JSON.stringify(a.json.apiConfig) !== JSON.stringify(b.json.apiConfig)) { problems.push(`${c.label}: generation config differs`); continue; }
    if (a.json.evaluationType !== b.json.evaluationType) { problems.push(`${c.label}: evaluationType ${a.json.evaluationType} vs ${b.json.evaluationType}`); continue; }
    identical++;
  }
  check(problems.length === 0, `server-built prompt + config identical to legacy for ${identical}/${cases.length} video evaluations`, problems.slice(0, 5).join('\n        '));

  // custom evaluation
  const customPrompt = 'Rate the clarity of the explanation.';
  const customContext = 'Audience: first-year students';
  const a = await evaluate({ videoDetails: buildCustomVideoDetails({ customPrompt, customContext }), promptbegining: seed.prompts.custom.text,
    structuredreturnedconfig: seed.prompts.custom.config, customPrompt, customContext, evaluationType: 'custom' });
  const b = await evaluate({ evaluationKind: 'custom', customPrompt, customContext });
  check(a.status === 200 && b.status === 200 && a.json.promptText === b.json.promptText && JSON.stringify(a.json.apiConfig) === JSON.stringify(b.json.apiConfig),
    'custom evaluation prompt identical', b.json);

  // response carries the exact config used
  const sample = cases.find((c) => c.kind === 'project' && c.id);
  const r = await evaluate({ videoAssignmentId: sample.id, evaluationKind: 'project' });
  const m = r.json?.evaluation_config;
  check(m?.videoAssignmentId === sample.id && m.promptVersion === 1 && m.rubricVersion === 1 && m.rubricId, 'response includes evaluation_config (video, prompt + rubric versions)', m);

  // ---- error handling ------------------------------------------------------------------
  const conceptId = cases.find((c) => c.kind === 'accuracy' && c.id).id;
  check((await evaluate({ videoAssignmentId: conceptId, evaluationKind: 'project' })).status === 400, 'project evaluation on a concept video → 400');
  check((await evaluate({ videoAssignmentId: '00000000-0000-0000-0000-000000000001', evaluationKind: 'accuracy' })).status === 404, 'unknown / other institution\'s video → 404');
  check((await evaluate({ evaluationKind: 'nonsense', videoAssignmentId: conceptId })).status === 400, 'unknown evaluationKind → 400');
  check((await evaluate({ evaluationKind: 'custom' })).status === 400, 'custom evaluation without customPrompt → 400');
  check((await evaluate({})).status === 400, 'request with neither evaluationKind nor a legacy prompt → 400');

  // ---- storing with videoAssignmentId records the exact versions ------------------------
  const projectSample = cases.find((c) => c.kind === 'project' && c.id);
  const st = await fetch(API + '/store-evaluation', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer tok:${STUDENT}` },
    body: JSON.stringify({ userId: 'stub', userEmail: STUDENT, videoUrl: 'https://youtu.be/prompt-test', videoType: 'project',
      selectedPhase: 'IGNORED — id wins', videoAssignmentId: projectSample.id, evaluationData: { evaluation_result: {} } }),
  }).then((x) => x.json());
  const row = (await db.query(
    `SELECT video_assignment_id, rubric_id, config_snapshot FROM tbl_ailabs_ytfeedback_project_evaluation WHERE id = $1`, [st.id])).rows[0];
  check(row?.video_assignment_id === projectSample.id && row.config_snapshot?.source === 'server-config' && row.config_snapshot?.rubric_version === 1 && row.config_snapshot?.prompt_versions?.project === 1,
    'stored evaluation records video_assignment_id + rubric/prompt versions', row);
  if (st.id) await db.query(`DELETE FROM tbl_ailabs_ytfeedback_project_evaluation WHERE id = $1`, [st.id]);

  if (fail) out('\n--- server log (last 30 lines) ---\n' + log.split('\n').slice(-30).join('\n'));
} catch (e) {
  out(`ERROR: ${e.stack || e.message}`);
  fail++;
} finally {
  if (server) server.kill();
  stub.close();
  await closeAll();
  out(`\n${pass} passed, ${fail} failed`);
  try { fs.writeFileSync(path.join(__dirname, 'last-test-prompts.txt'), `${new Date().toISOString()}\n${LINES.join('\n')}\n`); } catch {}
  process.exitCode = fail ? 1 : 0;
}
