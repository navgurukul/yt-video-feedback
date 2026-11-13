// Seeds Navgurukul / School of Programming into the TEST database from
// navgurukul-seed.json (an exact snapshot of src/data/*.ts).
// Idempotent: upserts on natural keys, so IDs stay stable across re-runs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'navgurukul-seed.json'), 'utf8'));

export const NG = {
  slug: 'navgurukul',
  name: 'Navgurukul',
  program: 'School of Programming',
  domains: ['navgurukul.org'],
};

const PROMPT_NAMES = {
  accuracy: 'Concept Accuracy',
  ability_to_explain: 'Ability to Explain',
  project: 'Project Explanation',
  custom: 'Custom Evaluation',
};

function levelsOf(name, criteria) {
  if (name === 'abilityToExplainRubric') return criteria.map((r) => r.Level);
  return Object.keys(criteria[0] || {}).filter((k) => /\(\d\)\s*$/.test(k));
}

export async function seedConfig(db, { superAdminEmail } = {}) {
  const c = await db.connect();
  try {
    await c.query('BEGIN');

    const inst = (await c.query(
      `INSERT INTO institutions (name, slug, type, allowed_email_domains, logo_url)
       VALUES ($1,$2,'ngo',$3,'/ng-logo.png')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
       RETURNING id`, [NG.name, NG.slug, NG.domains])).rows[0].id;

    const prog = (await c.query(
      `INSERT INTO programs (institution_id, name, description, sort_order)
       VALUES ($1,$2,'Web development phases 1–7 (HTML → Full-stack + AI)',1)
       ON CONFLICT (institution_id, name) DO UPDATE SET updated_at = NOW()
       RETURNING id`, [inst, NG.program])).rows[0].id;

    // Rubrics (version 1 = exactly what is hardcoded today)
    const rubricIds = {};
    for (const [key, criteria] of Object.entries(seed.rubrics)) {
      const type = key === 'abilityToExplainRubric' ? 'ability_to_explain' : 'project';
      const name = key === 'abilityToExplainRubric'
        ? 'Ability to Explain (Feynman)'
        : `Phase ${key.match(/Phase(\d+)/)[1]} Project Rubric`;
      rubricIds[key] = (await c.query(
        `INSERT INTO rubrics (institution_id, name, rubric_type, levels, criteria, version, created_by)
         VALUES ($1,$2,$3,$4,$5,1,'migration')
         ON CONFLICT (institution_id, name, version)
           DO UPDATE SET criteria = EXCLUDED.criteria, levels = EXCLUDED.levels
         RETURNING id`,
        [inst, name, type, JSON.stringify(levelsOf(key, criteria)), JSON.stringify(criteria)])).rows[0].id;
    }

    // Prompt templates: Navgurukul-owned copy + global default (institution_id NULL)
    const promptIds = {};
    for (const owner of [inst, null]) {
      for (const [kind, p] of Object.entries(seed.prompts)) {
        const id = (await c.query(
          `INSERT INTO prompt_templates (institution_id, kind, name, prompt_text, generation_config, version, created_by)
           VALUES ($1,$2,$3,$4,$5,1,'migration')
           ON CONFLICT ((COALESCE(institution_id,'00000000-0000-0000-0000-000000000000'::uuid)), kind, name, version)
             DO UPDATE SET prompt_text = EXCLUDED.prompt_text, generation_config = EXCLUDED.generation_config
           RETURNING id`,
          [owner, kind, PROMPT_NAMES[kind], p.text, JSON.stringify(p.config)])).rows[0].id;
        if (owner) promptIds[kind] = id;
      }
    }

    // Phases + concept videos
    const phaseIds = {};
    for (const [i, ph] of seed.videoDataStructure.entries()) {
      phaseIds[ph.phase] = (await c.query(
        `INSERT INTO phases (program_id, name, sort_order) VALUES ($1,$2,$3)
         ON CONFLICT (program_id, name) DO UPDATE SET sort_order = EXCLUDED.sort_order, updated_at = NOW()
         RETURNING id`, [prog, ph.phase, i + 1])).rows[0].id;
      for (const [j, v] of ph.videos.entries()) {
        await c.query(
          `INSERT INTO video_assignments (phase_id, video_type, title, what_to_cover, questions_to_answer,
             ability_rubric_id, accuracy_prompt_id, ability_prompt_id, sort_order)
           VALUES ($1,'concept',$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (phase_id, video_type, title) DO UPDATE SET
             what_to_cover = EXCLUDED.what_to_cover, questions_to_answer = EXCLUDED.questions_to_answer,
             ability_rubric_id = EXCLUDED.ability_rubric_id, accuracy_prompt_id = EXCLUDED.accuracy_prompt_id,
             ability_prompt_id = EXCLUDED.ability_prompt_id, sort_order = EXCLUDED.sort_order, updated_at = NOW()`,
          [phaseIds[ph.phase], v.title, v.whatToCover, JSON.stringify(v.questionsToAnswer),
           rubricIds.abilityToExplainRubric, promptIds.accuracy, promptIds.ability_to_explain, j + 1]);
      }
    }

    // Project videos (one per phase). Rubric follows the switch in VideoAnalyzer.tsx.
    for (const [i, ph] of seed.projectVideoDataStructure.entries()) {
      let phaseId = phaseIds[ph.phase];
      if (!phaseId) {
        phaseId = (await c.query(
          `INSERT INTO phases (program_id, name, sort_order) VALUES ($1,$2,$3)
           ON CONFLICT (program_id, name) DO UPDATE SET updated_at = NOW() RETURNING id`,
          [prog, ph.phase, 100 + i])).rows[0].id;
        phaseIds[ph.phase] = phaseId;
      }
      const n = (ph.phase.match(/^Phase (\d+)/) || [])[1];
      const rubricKey = rubricIds[`Phase${n}Rubric`] ? `Phase${n}Rubric` : 'Phase1Rubric';
      const v = ph.projectVideo;
      await c.query(
        `INSERT INTO video_assignments (phase_id, video_type, title, description, what_to_cover, key_topics,
           rubric_id, project_prompt_id, sort_order)
         VALUES ($1,'project',$2,$3,$4,$5,$6,$7,0)
         ON CONFLICT (phase_id, video_type, title) DO UPDATE SET
           description = EXCLUDED.description, what_to_cover = EXCLUDED.what_to_cover,
           key_topics = EXCLUDED.key_topics, rubric_id = EXCLUDED.rubric_id,
           project_prompt_id = EXCLUDED.project_prompt_id, updated_at = NOW()`,
        [phaseId, v.title, v.description, v.whatToCover, JSON.stringify(v.keyTopics),
         rubricIds[rubricKey], promptIds.project]);
    }

    if (superAdminEmail) {
      await c.query(
        `INSERT INTO user_memberships (email, institution_id, role) VALUES ($1, NULL, 'super_admin')
         ON CONFLICT DO NOTHING`, [superAdminEmail.trim().toLowerCase()]);
    }

    await c.query('COMMIT');
    return { institutionId: inst, programId: prog, phaseIds, rubricIds, promptIds };
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
