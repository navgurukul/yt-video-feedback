import {
  Phase1Rubric,
  Phase2Rubric,
  Phase3Rubric,
  Phase4Rubric,
  Phase5Rubric,
  Phase6Rubric,
  Phase7Rubric,
} from "../RubricData";

export {
  Phase1Rubric,
  Phase2Rubric,
  Phase3Rubric,
  Phase4Rubric,
  Phase5Rubric,
  Phase6Rubric,
  Phase7Rubric,
};

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