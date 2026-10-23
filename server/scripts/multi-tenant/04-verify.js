// Verifies the TEST database against PRODUCTION (read-only) and against the
// hardcoded src/data/* config. Returns { pass, report }.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { isDeepStrictEqual } from 'util';
import { fileURLToPath } from 'url';
import { LEGACY_TABLES } from './03-copy-from-prod.js';
import { buildConceptVideoDetails, buildProjectVideoDetails, composePrompt } from './prompt-builder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'navgurukul-seed.json'), 'utf8'));
const REPO = path.resolve(__dirname, '../../..');
// Byte-exact comparison: key order matters because the rubric is JSON.stringify-ed into the prompt.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function verify(prod, test, ids) {
  const report = [];
  let pass = true;
  const ok = (cond, msg) => { report.push(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) pass = false; };
  const warn = (msg) => report.push(`WARN  ${msg}`);

  // 0. Production session is read-only
  const ro = (await prod.query(`SELECT current_setting('transaction_read_only') AS ro`)).rows[0].ro;
  ok(ro === 'on', `production connection is read-only (transaction_read_only=${ro})`);

  // 0b. Seed snapshot is still in sync with src/data/*.ts
  for (const [f, sha] of Object.entries(seed.source_sha256)) {
    const p = path.join(REPO, f);
    if (!fs.existsSync(p)) { warn(`${f} not found, snapshot freshness not checked`); continue; }
    const now = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    ok(now === sha, `navgurukul-seed.json matches current ${f}`);
  }

  // 1. Row counts + per-user counts identical
  for (const t of LEGACY_TABLES) {
    const exists = (await prod.query(`SELECT to_regclass('public.' || $1) AS t`, [t])).rows[0].t;
    if (!exists) continue;
    const a = Number((await prod.query(`SELECT COUNT(*) c FROM public."${t}"`)).rows[0].c);
    const b = Number((await test.query(`SELECT COUNT(*) c FROM public."${t}"`)).rows[0].c);
    ok(a === b, `${t}: prod ${a} rows = test ${b} rows`);
    const n = Number((await test.query(`SELECT COUNT(*) c FROM public."${t}" WHERE institution_id IS NULL`)).rows[0].c);
    ok(n === 0, `${t}: rows without institution_id = ${n}`);

    const emailCol = t === 'tbl_manual_video_evaluations' ? 'evaluator_email'
      : ['tbl_llm_api_calls', 'tbl_user_issues'].includes(t) ? 'user_email' : 'email';
    const sql = `SELECT md5(string_agg(${emailCol} || ':' || c, ',' ORDER BY ${emailCol})) h FROM
                 (SELECT ${emailCol}, COUNT(*) c FROM public."${t}" GROUP BY 1) x`;
    const ha = (await prod.query(sql)).rows[0].h, hb = (await test.query(sql)).rows[0].h;
    ok(ha === hb, `${t}: per-user row counts identical (history pages will match)`);

    const idsql = `SELECT md5(string_agg(id::text, ',' ORDER BY id)) h FROM public."${t}"`;
    ok((await prod.query(idsql)).rows[0].h === (await test.query(idsql)).rows[0].h,
      `${t}: same ids (links like /analysis-results?id=… keep working)`);
  }

  // 2. Mapping of old evaluations to the new syllabus
  const unmatched = async (t, cols) => (await test.query(
    `SELECT ${cols}, COUNT(*)::int n FROM public."${t}" WHERE video_assignment_id IS NULL GROUP BY ${cols} ORDER BY n DESC`)).rows;
  for (const [t, cols] of [
    ['tbl_ailabs_ytfeedback_concept_evaluations', 'project_name, page_name'],
    ['tbl_ailabs_ytfeedback_project_evaluation', 'project_name'],
  ]) {
    const exists = (await test.query(`SELECT to_regclass('public.' || $1) AS t`, [t])).rows[0].t;
    if (!exists) continue;
    const rows = await unmatched(t, cols);
    const total = rows.reduce((a, r) => a + r.n, 0);
    if (total === 0) ok(true, `${t}: every row linked to a phase + video assignment`);
    else {
      warn(`${t}: ${total} rows not linked to a video assignment (names not in current syllabus):`);
      rows.slice(0, 15).forEach((r) => report.push(`        ${JSON.stringify(r)}`));
    }
  }

  // 2b. Old phase names that 05-legacy-name-mapping.sql linked to current phases
  if ((await test.query(`SELECT to_regclass('public.legacy_phase_name_map') AS t`)).rows[0].t) {
    const m = (await test.query(
      `SELECT m.old_name, ph.name AS current_phase FROM legacy_phase_name_map m JOIN phases ph ON ph.id = m.phase_id ORDER BY 1`)).rows;
    m.forEach((r) => report.push(`INFO  mapped old phase name "${r.old_name}" → "${r.current_phase}"`));
  }

  // 3. Config parity: DB → same structures as the hardcoded files
  const phases = (await test.query(
    `SELECT id, name FROM phases WHERE program_id = $1 ORDER BY sort_order`, [ids.programId])).rows;
  const va = (await test.query(
    `SELECT va.*, r.criteria AS rubric_criteria, ar.criteria AS ability_criteria,
            pa.prompt_text AS acc_text, pa.generation_config AS acc_cfg,
            pb.prompt_text AS abl_text, pb.generation_config AS abl_cfg,
            pp.prompt_text AS prj_text, pp.generation_config AS prj_cfg
       FROM video_assignments va
       LEFT JOIN rubrics r  ON r.id = va.rubric_id
       LEFT JOIN rubrics ar ON ar.id = va.ability_rubric_id
       LEFT JOIN prompt_templates pa ON pa.id = va.accuracy_prompt_id
       LEFT JOIN prompt_templates pb ON pb.id = va.ability_prompt_id
       LEFT JOIN prompt_templates pp ON pp.id = va.project_prompt_id
      WHERE va.phase_id = ANY($1) ORDER BY va.sort_order`, [phases.map((p) => p.id)])).rows;

  const dbConcept = phases
    .map((p) => ({ phase: p.name, videos: va.filter((v) => v.phase_id === p.id && v.video_type === 'concept')
      .map((v) => ({ title: v.title, whatToCover: v.what_to_cover, questionsToAnswer: v.questions_to_answer })) }))
    .filter((p) => p.videos.length);
  ok(same(dbConcept, seed.videoDataStructure), 'concept syllabus (phases, order, titles, questions) identical');

  const dbProject = phases
    .map((p) => { const v = va.find((x) => x.phase_id === p.id && x.video_type === 'project');
      return v && { phase: p.name, projectVideo: { title: v.title, description: v.description, whatToCover: v.what_to_cover, keyTopics: v.key_topics } }; })
    .filter(Boolean);
  ok(same(dbProject, seed.projectVideoDataStructure), 'project videos identical');

  // 4. Final prompt text sent to Gemini: legacy vs DB, for every video and every call
  let checked = 0, diffs = 0;
  const legacyRubricFor = (phase) => {
    const n = (phase.match(/^Phase (\d+)/) || [])[1];
    return seed.rubrics[`Phase${n}Rubric`] || seed.rubrics.Phase1Rubric;  // same as the switch
  };
  for (const ph of seed.videoDataStructure) {
    for (const v of ph.videos) {
      const row = va.find((x) => x.video_type === 'concept' && x.title === v.title &&
        phases.find((p) => p.id === x.phase_id)?.name === ph.phase);
      const legacyDetails = buildConceptVideoDetails(v);
      const dbDetails = row && buildConceptVideoDetails({ title: row.title, whatToCover: row.what_to_cover, questionsToAnswer: row.questions_to_answer });
      const pairs = [
        [composePrompt({ promptbegining: seed.prompts.accuracy.text, videoDetails: legacyDetails }),
         row && composePrompt({ promptbegining: row.acc_text, videoDetails: dbDetails })],
        [composePrompt({ promptbegining: seed.prompts.ability_to_explain.text, videoDetails: legacyDetails, rubric: seed.rubrics.abilityToExplainRubric }),
         row && composePrompt({ promptbegining: row.abl_text, videoDetails: dbDetails, rubric: row.ability_criteria })],
      ];
      for (const [a, b] of pairs) { checked++; if (a !== b) diffs++; }
      if (!row || !same(row.acc_cfg, seed.prompts.accuracy.config) ||
          !same(row.abl_cfg, seed.prompts.ability_to_explain.config)) diffs++;
    }
  }
  for (const ph of seed.projectVideoDataStructure) {
    const row = va.find((x) => x.video_type === 'project' && phases.find((p) => p.id === x.phase_id)?.name === ph.phase);
    const a = composePrompt({ promptbegining: seed.prompts.project.text, videoDetails: buildProjectVideoDetails(ph.projectVideo), rubric: legacyRubricFor(ph.phase) });
    const b = row && composePrompt({ promptbegining: row.prj_text,
      videoDetails: buildProjectVideoDetails({ title: row.title, description: row.description, whatToCover: row.what_to_cover, keyTopics: row.key_topics }),
      rubric: row.rubric_criteria });
    checked++; if (a !== b) diffs++;
    if (!row || !same(row.prj_cfg, seed.prompts.project.config)) diffs++;
  }
  ok(diffs === 0, `Gemini prompt text + generation config identical for ${checked} prompt builds (${diffs} differences)`);

  // 5. Summary numbers
  const s = (await test.query(`SELECT
      (SELECT COUNT(*) FROM institutions)::int institutions, (SELECT COUNT(*) FROM programs)::int programs,
      (SELECT COUNT(*) FROM phases)::int phases, (SELECT COUNT(*) FROM video_assignments)::int videos,
      (SELECT COUNT(*) FROM rubrics)::int rubrics, (SELECT COUNT(*) FROM prompt_templates)::int prompts,
      (SELECT COUNT(*) FROM user_memberships WHERE role='student')::int students,
      (SELECT COUNT(*) FROM user_memberships WHERE role='evaluator')::int evaluators,
      (SELECT COUNT(*) FROM user_memberships WHERE role='super_admin')::int super_admins`)).rows[0];
  report.push(`INFO  test DB now has: ${JSON.stringify(s)}`);
  return { pass, report };
}
