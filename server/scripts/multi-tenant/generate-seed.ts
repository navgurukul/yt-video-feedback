// Regenerates navgurukul-seed.json from src/data/*.ts.
// Run from the repo root:  npx tsx server/scripts/multi-tenant/generate-seed.ts
import * as vd from '../../../src/data/videoData';
import * as pv from '../../../src/data/phasevideodata';
import * as rd from '../../../src/data/RubricData';
import * as pr from '../../../src/data/prompt';
import { writeFileSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const files = ['src/data/videoData.ts', 'src/data/phasevideodata.ts', 'src/data/RubricData.ts', 'src/data/prompt.ts'];
const out = {
  generated_from: files,
  videoDataStructure: vd.videoDataStructure,
  projectVideoDataStructure: pv.projectVideoDataStructure,
  rubrics: {
    abilityToExplainRubric: rd.abilityToExplainRubric,
    Phase1Rubric: rd.Phase1Rubric, Phase2Rubric: rd.Phase2Rubric, Phase3Rubric: rd.Phase3Rubric,
    Phase4Rubric: rd.Phase4Rubric, Phase5Rubric: rd.Phase5Rubric, Phase6Rubric: rd.Phase6Rubric,
    Phase7Rubric: rd.Phase7Rubric,
  },
  prompts: {
    accuracy: { text: pr.AccuracyPrompt, config: pr.AccuracyConfig },
    ability_to_explain: { text: pr.AbilityToExplainPrompt, config: pr.AbilityToExplainConfig },
    project: { text: pr.ProjectPrompt, config: pr.projectconfig },
    custom: { text: pr.CustomPrompt, config: pr.CustomConfig },
  },
  source_sha256: Object.fromEntries(files.map((f) => [f, createHash('sha256').update(readFileSync(f)).digest('hex')])),
};
writeFileSync(path.join('server/scripts/multi-tenant/navgurukul-seed.json'), JSON.stringify(out, null, 2));
console.log('navgurukul-seed.json regenerated');
