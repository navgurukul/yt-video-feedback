// Creates (or refreshes) a "Demo MBA College" in the TEST database so you can try a
// second institution in the UI. Adds you as its institution admin, so the header's
// institution switcher lets you move between Navgurukul and the demo college.
//
//   cd server && node scripts/multi-tenant/seed-demo.js --admin you@navgurukul.org
//
// Re-runnable. Never touches the main database.
import { test as db, closeAll } from './db.js';

const i = process.argv.indexOf('--admin');
const admin = (i >= 0 ? process.argv[i + 1] : process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
if (!admin) { console.error('Usage: node scripts/multi-tenant/seed-demo.js --admin you@example.org'); process.exit(1); }

const LEVELS = ['Beginner (1)', 'Intermediate (2)', 'Advanced (3)', 'Expert (4)'];
const criterion = (name, weight, desc) => ({
  Parameter: name,
  'Weightage (%)': weight,
  'Beginner (1)': `${desc}: barely addressed; unclear or incorrect.`,
  'Intermediate (2)': `${desc}: partly addressed with some gaps.`,
  'Advanced (3)': `${desc}: clearly addressed with relevant examples.`,
  'Expert (4)': `${desc}: compelling, well-structured and insightful.`,
  Checklist: [`Explicitly covers ${name.toLowerCase()}`],
});

const c = await db.connect();
try {
  await c.query('BEGIN');
  const inst = (await c.query(
    `INSERT INTO institutions (name, slug, type, allowed_email_domains)
     VALUES ('Demo MBA College', 'demo-mba', 'college', '{demo-mba.edu}')
     ON CONFLICT (slug) DO UPDATE SET status = 'active', updated_at = NOW() RETURNING id`)).rows[0].id;

  const prog = (await c.query(
    `INSERT INTO programs (institution_id, name, description, sort_order) VALUES ($1, 'MBA 2026', 'Business communication', 1)
     ON CONFLICT (institution_id, name) DO UPDATE SET is_active = TRUE RETURNING id`, [inst])).rows[0].id;

  const rubric = async (name, type, levels, criteria) => (await c.query(
    `INSERT INTO rubrics (institution_id, name, rubric_type, levels, criteria, version, created_by)
     VALUES ($1,$2,$3,$4,$5::text::json,1,'seed-demo')
     ON CONFLICT (institution_id, name, version) DO UPDATE SET criteria = EXCLUDED.criteria RETURNING id`,
    [inst, name, type, JSON.stringify(levels), JSON.stringify(criteria)])).rows[0].id;

  const pitchRubric = await rubric('Business Pitch Rubric', 'project', LEVELS, [
    criterion('Problem & Market Understanding', 30, 'Defines the customer problem and market size'),
    criterion('Solution & Business Model', 30, 'Explains the offering, pricing and revenue model'),
    criterion('Data & Evidence', 20, 'Supports claims with numbers and sources'),
    criterion('Communication & Delivery', 20, 'Structure, clarity, confidence and time management'),
  ]);
  // Re-use Navgurukul's ability-to-explain rubric text (it is subject-neutral)
  const ngAbility = (await c.query(
    `SELECT r.levels, r.criteria::text AS criteria FROM rubrics r JOIN institutions i ON i.id = r.institution_id
      WHERE i.slug = 'navgurukul' AND r.rubric_type = 'ability_to_explain' AND r.is_active LIMIT 1`)).rows[0];
  const abilityRubric = await rubric('Ability to Explain', 'ability_to_explain', ngAbility.levels, JSON.parse(ngAbility.criteria));

  const globalPrompt = async (kind) => (await c.query(
    `SELECT id FROM prompt_templates WHERE institution_id IS NULL AND kind = $1 AND is_active ORDER BY version DESC LIMIT 1`, [kind])).rows[0].id;
  const [accuracy, ability, project] = [await globalPrompt('accuracy'), await globalPrompt('ability_to_explain'), await globalPrompt('project')];

  const phase = async (name, order) => (await c.query(
    `INSERT INTO phases (program_id, name, sort_order) VALUES ($1,$2,$3)
     ON CONFLICT (program_id, name) DO UPDATE SET is_active = TRUE RETURNING id`, [prog, name, order])).rows[0].id;
  const m1 = await phase('Module 1: Marketing Fundamentals', 1);
  const m2 = await phase('Module 2: Corporate Finance Basics', 2);

  const video = async (phaseId, type, title, fields) => c.query(
    `INSERT INTO video_assignments (phase_id, video_type, title, description, what_to_cover, questions_to_answer, key_topics,
        rubric_id, ability_rubric_id, accuracy_prompt_id, ability_prompt_id, project_prompt_id, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (phase_id, video_type, title) DO UPDATE SET is_active = TRUE`,
    [phaseId, type, title, fields.description || null, fields.whatToCover, JSON.stringify(fields.questions || []), JSON.stringify(fields.topics || []),
     type === 'project' ? pitchRubric : null, type === 'concept' ? abilityRubric : null,
     type === 'concept' ? accuracy : null, type === 'concept' ? ability : null, type === 'project' ? project : null, fields.order || 1]);

  await video(m1, 'concept', 'The 4P Marketing Mix', { order: 1,
    whatToCover: 'Explain Product, Price, Place and Promotion with one real brand as the running example.',
    questions: ['What are the 4Ps and why do they matter?', 'How does changing price affect the other Ps?', 'Which P is most important for a new D2C brand, and why?'] });
  await video(m1, 'concept', 'Customer Segmentation & Targeting', { order: 2,
    whatToCover: 'Explain how to segment a market and choose a target segment.',
    questions: ['What bases can be used to segment a market?', 'How do you evaluate segment attractiveness?', 'Give an example of a well-targeted product.'] });
  await video(m1, 'project', 'Go-to-Market Pitch', {
    description: 'A 5–8 minute pitch of a go-to-market plan for a new product.',
    whatToCover: 'Present the target customer, positioning, pricing, channels and launch plan, with numbers.',
    topics: ['Target segment', 'Positioning statement', 'Pricing rationale', 'Channel strategy', 'Launch budget & KPIs'] });
  await video(m2, 'concept', 'Time Value of Money', { order: 1,
    whatToCover: 'Explain present value, future value and discounting.',
    questions: ['Why is a rupee today worth more than a rupee tomorrow?', 'How do you compute the present value of a future cash flow?'] });

  await c.query(
    `INSERT INTO user_memberships (email, institution_id, role) VALUES ($1,$2,'institution_admin') ON CONFLICT DO NOTHING`, [admin, inst]);
  await c.query('COMMIT');
  console.log(`Demo MBA College ready (slug demo-mba). ${admin} is its institution admin.`);
  console.log('Reload the app; use the institution switcher in the header to move between institutions.');
} catch (e) {
  await c.query('ROLLBACK');
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  c.release();
  await closeAll();
}
