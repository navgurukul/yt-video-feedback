export { Phase1Rubric } from "./phase1Rubric";
export { Phase2Rubric } from "./phase2Rubric";
export { Phase3Rubric } from "./phase3Rubric";
export { Phase4Rubric } from "./phase4Rubric";
export { Phase5Rubric } from "./phase5Rubric";
export { Phase6Rubric } from "./phase6Rubric";
export { Phase7Rubric } from "./phase7Rubric";

import { Phase1Rubric } from "./phase1Rubric";
import { Phase2Rubric } from "./phase2Rubric";
import { Phase3Rubric } from "./phase3Rubric";
import { Phase4Rubric } from "./phase4Rubric";
import { Phase5Rubric } from "./phase5Rubric";
import { Phase6Rubric } from "./phase6Rubric";
import { Phase7Rubric } from "./phase7Rubric";

export const projectRubricCatalog = {
  "Phase 1: Student Profile & Course Portal (HTML Only)": {
    title: "Phase 1 — HTML Project Evaluation",
    rubric: Phase1Rubric,
  },
  "Phase 2: Dressing Up Your Websites with CSS": {
    title: "Phase 2 — CSS Project Evaluation",
    rubric: Phase2Rubric,
  },
  "Phase 3: Bringing Your Websites to Life with JavaScript!": {
    title: "Phase 3 — JavaScript Project Evaluation",
    rubric: Phase3Rubric,
  },
  "Phase 4: Building an AI-Powered Content Generator with Modern JavaScript & Gemini API": {
    title: "Phase 4 — Advanced JavaScript and API Integration Evaluation",
    rubric: Phase4Rubric,
  },
  "Phase 5: Your First Backend with Node.js, Express & Gemini AI": {
    title: "Phase 5 — Backend with Node.js and Express Evaluation",
    rubric: Phase5Rubric,
  },
  "Phase 6: Your First Database with MongoDB & Mongoose": {
    title: "Phase 6 — MongoDB and Mongoose Evaluation",
    rubric: Phase6Rubric,
  },
  "Phase 7: Final Full-Stack Project with AI Integration": {
    title: "Phase 7 — CollabSphere Full-Stack Capstone Project Evaluation",
    rubric: Phase7Rubric,
  },
} as const;